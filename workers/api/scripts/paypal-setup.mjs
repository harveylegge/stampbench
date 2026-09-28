#!/usr/bin/env node
/**
 * One-time setup for PayPal Subscriptions.
 *
 * PayPal's recurring billing needs three things to exist in *their* account
 * before our worker can sell anything: a catalog product, one billing plan per
 * tier, and a webhook registration. All three are API-only or buried deep in
 * the dashboard, and each produces an opaque id that has to be pasted into
 * Cloudflare. This script creates them and prints the exact secrets block to
 * paste, so the setup is a copy-paste rather than an afternoon.
 *
 * Usage (from the repo root):
 *
 *   PAYPAL_CLIENT_ID=… PAYPAL_SECRET=… node workers/api/scripts/paypal-setup.mjs --sandbox
 *   PAYPAL_CLIENT_ID=… PAYPAL_SECRET=… node workers/api/scripts/paypal-setup.mjs
 *
 * Flags:
 *   --sandbox        Use PayPal's test environment (do this first).
 *   --site <url>     Where the webhook should be delivered. Default
 *                    https://stampbench.com — must be public HTTPS; PayPal
 *                    refuses localhost.
 *   --skip-webhook   Only create the product and plans.
 *
 * Safe to re-run: it reuses anything that already exists by name rather than
 * creating duplicates. Sandbox and live are entirely separate — separate
 * credentials, separate ids — so run it once per environment and keep the two
 * sets of secrets apart.
 *
 * It prints ids, never secrets. Your client secret is read from the
 * environment and stays there.
 */

import { pathToFileURL } from 'node:url';

/**
 * The tiers to create in PayPal.
 *
 * Mirrors `apps/web/lib/plans.ts`, which is the source of truth for what the
 * site charges — a test asserts the two agree, because a price that matches
 * the pricing page everywhere except PayPal is the kind of mistake that only
 * surfaces on someone's bank statement.
 *
 * Changing a price here does not re-price an existing PayPal plan: plans are
 * immutable once subscribers are attached, so a real price change means new
 * plan ids and a migration of existing subscribers.
 */
export const PAYPAL_TIERS = [
  { plan: 'starter', label: 'Developer', priceGbp: 29 },
  { plan: 'pro', label: 'Agency', priceGbp: 99 },
  { plan: 'scale', label: 'Platform', priceGbp: 299 },
];

/** The events the worker acts on. Anything else is noise we would ignore. */
export const WEBHOOK_EVENTS = [
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.RE-ACTIVATED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED',
];

const PRODUCT_NAME = 'Stampbench';
const CURRENCY = 'GBP';

const API_BASE = {
  live: 'https://api-m.paypal.com',
  sandbox: 'https://api-m.sandbox.paypal.com',
};

function parseArgs(argv) {
  const args = { env: 'live', site: 'https://stampbench.com', webhook: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sandbox') args.env = 'sandbox';
    else if (argv[i] === '--skip-webhook') args.webhook = false;
    else if (argv[i] === '--site') args.site = argv[++i];
    else if (argv[i].startsWith('--site=')) args.site = argv[i].slice('--site='.length);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

async function getToken(base, clientId, secret) {
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(
      `Could not authenticate with PayPal (${res.status}). ` +
        `Check the credentials, and that they belong to the ${base.includes('sandbox') ? 'sandbox' : 'live'} environment.\n` +
        JSON.stringify(body, null, 2),
    );
  }
  return body.access_token;
}

function makeApi(base, token) {
  return async function api(method, path, body) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Ask for the created object back rather than a bare id + links.
        ...(method === 'POST' ? { Prefer: 'return=representation' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let parsed = {};
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text.slice(0, 500) };
      }
    }
    if (!res.ok) {
      const detail = parsed.details ? `\n${JSON.stringify(parsed.details, null, 2)}` : '';
      throw new Error(`PayPal ${method} ${path} failed (${res.status}): ${parsed.message ?? text.slice(0, 300)}${detail}`);
    }
    return parsed;
  };
}

/** Reuse the catalog product if it is already there — this script is re-runnable. */
async function ensureProduct(api) {
  const existing = await api('GET', '/v1/catalogs/products?page_size=20');
  const found = (existing.products ?? []).find((p) => p.name === PRODUCT_NAME);
  if (found) {
    console.log(`· product exists: ${found.id}`);
    return found.id;
  }
  const created = await api('POST', '/v1/catalogs/products', {
    name: PRODUCT_NAME,
    description: 'E-invoicing validation, generation and repair (EN 16931 / XRechnung).',
    type: 'SERVICE',
    category: 'SOFTWARE',
    home_url: 'https://stampbench.com',
  });
  console.log(`· product created: ${created.id}`);
  return created.id;
}

async function ensurePlan(api, productId, tier) {
  const name = `${PRODUCT_NAME} ${tier.label}`;
  const existing = await api('GET', `/v1/billing/plans?product_id=${encodeURIComponent(productId)}&page_size=20`);
  const found = (existing.plans ?? []).find((p) => p.name === name && p.status === 'ACTIVE');
  if (found) {
    console.log(`· plan exists:   ${tier.plan.padEnd(7)} ${found.id}`);
    return found.id;
  }
  const created = await api('POST', '/v1/billing/plans', {
    product_id: productId,
    name,
    description: `${name} — £${tier.priceGbp}/month, billed monthly.`,
    status: 'ACTIVE',
    billing_cycles: [
      {
        frequency: { interval_unit: 'MONTH', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        // 0 = renew forever, which is the entire point of this exercise.
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: { value: String(tier.priceGbp), currency_code: CURRENCY },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: { value: '0', currency_code: CURRENCY },
      setup_fee_failure_action: 'CONTINUE',
      // After three consecutive failures PayPal suspends the subscription,
      // which our webhook turns into a downgrade. Without a threshold a dead
      // card would keep a paid plan alive indefinitely.
      payment_failure_threshold: 3,
    },
  });
  console.log(`· plan created:  ${tier.plan.padEnd(7)} ${created.id}`);
  return created.id;
}

async function ensureWebhook(api, url) {
  const existing = await api('GET', '/v1/notifications/webhooks');
  const found = (existing.webhooks ?? []).find((w) => w.url === url);
  if (found) {
    const have = new Set((found.event_types ?? []).map((e) => e.name));
    const missing = WEBHOOK_EVENTS.filter((e) => !have.has(e));
    if (missing.length) {
      // A webhook that exists but is not subscribed to ACTIVATED would look
      // fine and never activate anyone.
      await api('PATCH', `/v1/notifications/webhooks/${encodeURIComponent(found.id)}`, [
        { op: 'replace', path: '/event_types', value: WEBHOOK_EVENTS.map((name) => ({ name })) },
      ]);
      console.log(`· webhook updated: ${found.id} (added ${missing.length} event type(s))`);
    } else {
      console.log(`· webhook exists:  ${found.id}`);
    }
    return found.id;
  }
  const created = await api('POST', '/v1/notifications/webhooks', {
    url,
    event_types: WEBHOOK_EVENTS.map((name) => ({ name })),
  });
  console.log(`· webhook created: ${created.id}`);
  return created.id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) {
    console.error(
      'Set PAYPAL_CLIENT_ID and PAYPAL_SECRET first.\n\n' +
        'Get them from the PayPal Developer dashboard → Apps & Credentials →\n' +
        'your REST app. Use the Sandbox tab with --sandbox, the Live tab without.',
    );
    process.exit(1);
  }

  const webhookUrl = `${args.site.replace(/\/+$/, '')}/api/paypal/webhook`;
  if (!webhookUrl.startsWith('https://')) {
    console.error(`The webhook URL must be public HTTPS — PayPal will not accept ${webhookUrl}`);
    process.exit(1);
  }

  const base = API_BASE[args.env];
  console.log(`\nPayPal setup — ${args.env.toUpperCase()} (${base})\n`);

  const api = makeApi(base, await getToken(base, clientId, secret));
  const productId = await ensureProduct(api);

  const planIds = {};
  for (const tier of PAYPAL_TIERS) {
    planIds[tier.plan] = await ensurePlan(api, productId, tier);
  }

  let webhookId = null;
  if (args.webhook) webhookId = await ensureWebhook(api, webhookUrl);

  console.log(`
─────────────────────────────────────────────────────────────
Paste these into the Cloudflare Pages project (stampbench) as
encrypted environment variables, then redeploy:

PAYPAL_CLIENT_ID     = (the client id you just used)
PAYPAL_SECRET        = (the secret you just used)
PAYPAL_WEBHOOK_ID    = ${webhookId ?? '(run without --skip-webhook to create one)'}
PAYPAL_PLAN_STARTER  = ${planIds.starter}
PAYPAL_PLAN_PRO      = ${planIds.pro}
PAYPAL_PLAN_SCALE    = ${planIds.scale}${args.env === 'sandbox' ? '\nPAYPAL_ENV           = sandbox' : ''}

Webhook delivery URL: ${webhookUrl}
─────────────────────────────────────────────────────────────

Then check https://${args.site.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/api/billing/status
reports "paypalSubscriptions": true.${
    args.env === 'sandbox'
      ? '\n\nSandbox reminder: pay with a sandbox buyer account from the Developer\ndashboard, not your real PayPal login.'
      : '\n\nThis is LIVE: the next person who subscribes is charged real money.'
  }
`);
}

// Only run when executed directly, so the tables above can be imported by
// tests. pathToFileURL rather than string-building a file: URL — on Windows a
// drive letter would otherwise be parsed as the URL's host.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  });
}
