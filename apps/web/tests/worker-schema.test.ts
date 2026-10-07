/**
 * Cold-start schema check for the billing paths.
 *
 * On 2026-08-17 the remote D1 was missing `users.paypal_subscription_id`: the
 * ALTER from migration 003 had never been run. Because every user read is
 * `SELECT *`, the column just came back undefined and nothing in the request
 * paths (login, /account, /pricing) noticed. The first symptom would have been
 * a paying customer stranded on Free. These tests fix that class of miss in
 * place: the pure decision has explicit coverage for each drift shape, and the
 * D1 adapter is exercised against a stub that lets us simulate a migration
 * that was never applied.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkUsersSchema,
  evaluateSchema,
  resetSchemaCheckForTests,
  schemaFailureMessage,
  USERS_BILLING_COLUMNS,
} from '../../../workers/api/src/schema';

const FULL_SCHEMA = [
  'id',
  'email',
  'pw_hash',
  'pw_salt',
  'plan',
  'created_at',
  'stripe_customer_id',
  'stripe_subscription_id',
  'paypal_subscription_id',
];

describe('evaluateSchema', () => {
  it('accepts a users table with every billing column present', () => {
    expect(evaluateSchema(FULL_SCHEMA)).toEqual({ ok: true, missing: [] });
  });

  it('catches the 2026-08-17 near-miss shape: migration 003 not applied', () => {
    // The exact production drift: Stripe columns exist, PayPal column does not.
    const cols = FULL_SCHEMA.filter((c) => c !== 'paypal_subscription_id');
    expect(evaluateSchema(cols)).toEqual({
      ok: false,
      missing: ['paypal_subscription_id'],
    });
  });

  it('reports every missing column, not just the first', () => {
    // The pre-002 shape: neither Stripe nor PayPal columns are there yet.
    const cols = ['id', 'email', 'pw_hash', 'pw_salt', 'plan', 'created_at'];
    expect(evaluateSchema(cols).missing.sort()).toEqual(
      [...USERS_BILLING_COLUMNS].sort(),
    );
  });

  it('is tolerant of unknown columns: a later migration may add more', () => {
    expect(evaluateSchema([...FULL_SCHEMA, 'future_column']).ok).toBe(true);
  });
});

describe('schemaFailureMessage', () => {
  it('is empty when the schema is fine', () => {
    expect(schemaFailureMessage({ ok: true, missing: [] })).toBe('');
  });

  it('names the specific column and the migration file to run', () => {
    const msg = schemaFailureMessage({ ok: false, missing: ['paypal_subscription_id'] });
    // Names both the column and the migration file so the log line and the
    // 503 body are enough on their own to fix the deploy.
    expect(msg).toContain('users.paypal_subscription_id');
    expect(msg).toContain('003_paypal_subscriptions.sql');
  });

  it('de-duplicates when two missing columns come from the same migration', () => {
    const msg = schemaFailureMessage({
      ok: false,
      missing: ['stripe_customer_id', 'stripe_subscription_id'],
    });
    // Both live in migration 002: the operator should see it once, not twice.
    const occurrences = msg.split('002_security_and_billing.sql').length - 1;
    expect(occurrences).toBe(1);
  });
});

// -------------------------------------------------------- D1 adapter

/**
 * Minimal D1Database stub with just the surface `checkUsersSchema` uses. The
 * real driver is not available in Node tests, and this is enough to exercise
 * the caching and error paths without pulling miniflare in for four calls.
 */
function fakeDb(columns: string[]): D1Database {
  let calls = 0;
  const results = columns.map((name) => ({ name }));
  const statement = {
    bind() {
      return statement;
    },
    async first() {
      return null;
    },
    async run() {
      return { success: true, meta: { changes: 0 } };
    },
    async all() {
      calls += 1;
      return { results, success: true, meta: { changes: 0 } };
    },
  } as unknown as D1PreparedStatement;
  return {
    prepare() {
      return statement;
    },
    async batch() {
      return [];
    },
    async exec() {
      return { count: 0, duration: 0 };
    },
    _callCount: () => calls,
  } as D1Database & { _callCount(): number };
}

function throwingDb(): D1Database {
  const statement = {
    bind() {
      return statement;
    },
    async first() {
      throw new Error('D1 unavailable');
    },
    async run() {
      throw new Error('D1 unavailable');
    },
    async all() {
      throw new Error('D1 unavailable');
    },
  } as unknown as D1PreparedStatement;
  return {
    prepare() {
      return statement;
    },
    async batch() {
      return [];
    },
    async exec() {
      throw new Error('D1 unavailable');
    },
  } as D1Database;
}

describe('checkUsersSchema (D1 adapter)', () => {
  beforeEach(() => {
    resetSchemaCheckForTests();
  });

  it('passes on a fully migrated table', async () => {
    const db = fakeDb(FULL_SCHEMA);
    await expect(checkUsersSchema(db)).resolves.toEqual({ ok: true, missing: [] });
  });

  it('catches the missing PayPal column that caused the 2026-08-17 near-miss', async () => {
    const db = fakeDb(FULL_SCHEMA.filter((c) => c !== 'paypal_subscription_id'));
    await expect(checkUsersSchema(db)).resolves.toEqual({
      ok: false,
      missing: ['paypal_subscription_id'],
    });
  });

  it('caches a successful check so cold-start pays for the pragma exactly once', async () => {
    const db = fakeDb(FULL_SCHEMA) as D1Database & { _callCount(): number };
    await checkUsersSchema(db);
    await checkUsersSchema(db);
    await checkUsersSchema(db);
    expect(db._callCount()).toBe(1);
  });

  it('treats a pragma error as a schema drift (fails closed on the billing path)', async () => {
    const check = await checkUsersSchema(throwingDb());
    expect(check.ok).toBe(false);
    // Reporting every billing column as missing is the honest answer when the
    // pragma itself failed: the caller cannot prove anything specific is safe.
    expect(check.missing.sort()).toEqual([...USERS_BILLING_COLUMNS].sort());
  });

  it('does NOT cache a pragma error: the next request must retry', async () => {
    // Otherwise one transient D1 blip poisons the isolate for its whole life
    // and every billing request 503s until a redeploy.
    const bad = await checkUsersSchema(throwingDb());
    expect(bad.ok).toBe(false);
    const good = await checkUsersSchema(fakeDb(FULL_SCHEMA));
    expect(good.ok).toBe(true);
  });
});
