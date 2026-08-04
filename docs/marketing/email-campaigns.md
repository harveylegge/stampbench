# Stampbench — Onboarding Drip (5 emails)

Plain text, from "{founder first name} at Stampbench", sent via the app (transactional-style, minimal footer). Triggers are behavioural, not calendar-blind: an email is skipped if its goal is already met. All copy British English; a German variant set should mirror these once volume justifies it.

**Sequence logic**

| # | Email | Trigger |
| --- | --- | --- |
| 1 | Welcome | Signup |
| 2 | First validation | 48h after signup if no successful API call yet |
| 3 | Quota nudge | Usage crosses 80% of free tier |
| 4 | Upgrade case | 7 days after quota nudge, or second month of >80% usage |
| 5 | Win-back | 30 days of zero API calls (previously active accounts) |

---

## Email 1 — Welcome

**Subject:** Your Stampbench API key (and the 60-second first call)

Hi {first_name},

Thanks for signing up. Your API key is in the dashboard: {dashboard_link}

The fastest first win — validate an invoice in one request:

    curl -X POST https://api.stampbench.com/v1/validate \
      -H "Authorization: Bearer YOUR_KEY" \
      -H "Content-Type: application/xml" \
      --data-binary @invoice.xml

You'll get back every failing rule with a plain-language explanation and a link to its documentation page. No invoice XML to hand? The playground has broken examples you can copy: {playground_link}

Two things worth knowing up front:

- The open-source library (`npm install @stampbench/core`) validates locally, unlimited, free forever. The API exists for when you want hosted validation, generation, and the AI explanations.
- Your free tier is 100 API calls/month. It resets on the 1st.

If you're integrating ahead of the 2027 mandate and something's unclear, reply to this email — it reaches me directly, and I answer.

{founder_name}

---

## Email 2 — First validation (sent only if no API call after 48h)

**Subject:** Stuck on the first request?

Hi {first_name},

You created an API key a couple of days ago but no request has landed yet — usually that means one of three things:

1. **No test invoice.** Grab a minimal valid XRechnung (and a deliberately broken one) here: {examples_link}
2. **Auth trouble.** The key goes in the `Authorization: Bearer` header; the two most common 401 causes are a trailing space and using the test key against the live URL.
3. **You actually wanted the library.** If your invoices are generated in Node, `npm install @stampbench/core` and `validate(xml)` locally — no API call needed, no quota used.

The quickstart covers all three in about four minutes: {quickstart_link}

If it's something else, reply and tell me what you're building — I read every response.

{founder_name}

---

## Email 3 — Quota nudge (at 80% of free tier)

**Subject:** You've used 80 of your 100 free calls this month

Hi {first_name},

Quick heads-up: you're at {usage}/100 API calls for {month}. When you hit 100, requests return `429` until the 1st — nothing breaks permanently, but validations will pause.

Three options, in honest order of cheapness:

1. **Move local validation to the library.** If most of your calls are validate-only, `@stampbench/core` does it locally and free, and you keep API calls for generation and AI explanations.
2. **Wait for the reset** on the 1st — fine if this was a testing spike.
3. **Upgrade to Starter** (£19/month, 2,500 calls) if this is production traffic: {upgrade_link}

You can see exactly which endpoints are consuming quota in the dashboard: {usage_link}

{founder_name}

---

## Email 4 — Upgrade case (sustained high usage)

**Subject:** The maths on Starter, for how you're using Stampbench

Hi {first_name},

You've been near your free-tier ceiling for a while — {usage_summary}. At that level, here's the honest comparison:

- **Starter (£19/mo):** 2,500 calls — 25× your current ceiling, no more month-end pauses.
- **Self-hosting the official validator instead:** free software, but a Java service you deploy, monitor, and update every time KoSIT ships a new rule release — plus no generation endpoint and no explanations. Most teams price that at well over £19 of engineering time per month.
- **Invopop or InvoiceXML:** solid products; entry pricing €50/mo and $99/mo respectively.

One more thing that matters for production: paid tiers get priority processing, and Pro adds priority support with a same-day response from the person who wrote the validator (me).

Upgrade takes about a minute: {upgrade_link} — and if your usage pattern doesn't fit any tier, reply and tell me; pricing feedback genuinely shapes the roadmap.

{founder_name}

---

## Email 5 — Win-back (30 days inactive)

**Subject:** Should I close the loop on your Stampbench integration?

Hi {first_name},

Your last API call was {last_active_date}, so I wanted to check in once rather than let the account drift.

If the integration shipped and you've moved validation into the open-source library — that's a success, not churn; no action needed, and the API key stays ready for when you want generation or explanations.

If you hit a wall, I'd honestly like to know where. Reply with one line — "the errors weren't clear", "missing CII support", "deadline slipped" — and I'll tell you straight whether it's fixed, on the roadmap, or not coming.

And if e-invoicing simply moved down the backlog: fair enough. The 2027 issuing mandate isn't moving, though, so when it resurfaces your key and remaining free quota will be here.

Since you signed up we've shipped: {recent_changelog_items}.

{founder_name}

---

## Sequence hygiene

- Every email has a working one-click unsubscribe from non-transactional mail; emails 3 and part of 1 are usage notices and remain transactional.
- Suppress the whole sequence for accounts that upgrade (they get a separate, shorter paid-onboarding note).
- Replies route to the founder inbox with the account's usage context attached.
- Review copy quarterly against reality — quota sizes, prices, and shipped features must match the app before anything sends.
