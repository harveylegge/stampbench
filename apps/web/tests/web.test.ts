import { describe, expect, it } from 'vitest';
import {
  EN16931_SPEC_ID,
  listRulesets,
  rulesForProfile,
  XRECHNUNG_30_SPEC_ID,
} from '@stampbench/core';
import { currentPeriodStart, planFor, PLANS } from '../lib/plans';
import { generateApiKey, hashApiKey } from '../lib/api-keys';
import { rateLimit } from '../lib/ratelimit';
import { de, en } from '../lib/copy';
import { RULE_FAMILIES } from '../components/stats-board';
import { describeUnreadableDrop } from '../app/playground/playground';
import {
  CAPABILITIES,
  MARKET_IDS,
  MARKETS,
  PAGE_MARKETS,
  PICKER_MARKETS,
  profileFromSpecId,
  RULE_COUNTS,
  RULESETS,
  SPEC_IDS,
  isMarketId,
} from '../lib/markets';

describe('plans', () => {
  it('falls back to free for unknown plan ids', () => {
    expect(planFor('nonsense').id).toBe('free');
    expect(planFor(null).id).toBe('free');
    expect(planFor('pro').id).toBe('pro');
  });

  it('quotas strictly increase across tiers', () => {
    expect(PLANS.free.monthlyQuota).toBeLessThan(PLANS.starter.monthlyQuota);
    expect(PLANS.starter.monthlyQuota).toBeLessThan(PLANS.pro.monthlyQuota);
    expect(PLANS.pro.monthlyQuota).toBeLessThan(PLANS.scale.monthlyQuota);
  });

  it('period start is the first of the month at UTC midnight', () => {
    const start = currentPeriodStart(new Date('2026-08-15T13:45:00Z'));
    expect(start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('api keys', () => {
  it('generates prefixed, high-entropy keys with a stable hash', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).toMatch(/^ig_live_[0-9a-f]{48}$/);
    expect(a.key).not.toBe(b.key);
    expect(a.prefix).toBe(a.key.slice(0, 15));
    expect(hashApiKey(a.key)).toBe(a.keyHash);
    expect(hashApiKey(a.key)).toHaveLength(64); // sha256 hex
    expect(a.keyHash).not.toBe(b.keyHash);
  });
});

/**
 * The market model makes public claims about coverage, so the claims are
 * tested rather than trusted. Two things are being defended here: that the
 * numbers on the marketing pages are the engine's real numbers, and that no
 * market can quietly acquire a capability it does not have.
 */
describe('markets', () => {
  it('rule counts match the engine, so the pages cannot overstate coverage', () => {
    expect(RULE_COUNTS.en16931).toBe(rulesForProfile('en16931').length);
    expect(RULE_COUNTS.xrechnung).toBe(rulesForProfile('xrechnung').length);
    // The German profile is the European core plus something, never less.
    expect(RULE_COUNTS.xrechnung).toBeGreaterThan(RULE_COUNTS.en16931);
  });

  it('mirrors the engine’s spec ids and ruleset ids', () => {
    expect(SPEC_IDS.en16931).toBe(EN16931_SPEC_ID);
    expect(SPEC_IDS.xrechnung).toBe(XRECHNUNG_30_SPEC_ID);
    const registered = listRulesets().map((r) => r.id);
    expect(registered).toContain(RULESETS.en16931.id);
    expect(registered).toContain(RULESETS.xrechnung.id);
  });

  it('scores every market against every capability', () => {
    for (const id of MARKET_IDS) {
      for (const capability of CAPABILITIES) {
        expect(MARKETS[id].capabilities[capability.id]).toBeDefined();
      }
    }
  });

  it('never leaves a qualified answer unexplained', () => {
    for (const id of MARKET_IDS) {
      for (const capability of CAPABILITIES) {
        const cell = MARKETS[id].capabilities[capability.id];
        // 'context' means "yes, but only when…" — without the qualifier it
        // reads as a plain yes, which would be the overstatement we exist to
        // avoid.
        if (cell.status === 'context') expect(cell.note, `${id}/${capability.id}`).toBeTruthy();
      }
    }
  });

  it('claims no national ruleset outside Germany', () => {
    expect(MARKETS.germany.capabilities.domestic.status).toBe('yes');
    expect(MARKETS.uk.capabilities.domestic.status).toBe('no');
    expect(MARKETS.us.capabilities.domestic.status).toBe('no');
    // Tax-rate determination and network delivery are not implemented anywhere.
    for (const id of MARKET_IDS) {
      expect(MARKETS[id].capabilities.rates.status).toBe('no');
      expect(MARKETS[id].capabilities.network.status).toBe('no');
    }
  });

  it('only routes to markets that have a page', () => {
    for (const id of PAGE_MARKETS) expect(MARKETS[id].hasPage).toBe(true);
    for (const id of MARKET_IDS) {
      if (MARKETS[id].hasPage) expect(PAGE_MARKETS).toContain(id);
    }
    expect(isMarketId('uk')).toBe(true);
    expect(isMarketId('atlantis')).toBe(false);
  });

  it('reads the profile a document declares in BT-24', () => {
    expect(profileFromSpecId(XRECHNUNG_30_SPEC_ID)).toBe('xrechnung');
    expect(profileFromSpecId(EN16931_SPEC_ID)).toBe('en16931');
    expect(profileFromSpecId(undefined)).toBeNull();
    expect(profileFromSpecId('urn:something:else')).toBeNull();
  });

  it('offers a localised card for every market in the picker', () => {
    for (const copy of [en, de]) {
      const ids = copy.markets.cards.map((c) => c.id);
      for (const id of PICKER_MARKETS) expect(ids, copy.locale).toContain(id);
    }
  });

  it('keeps the showcase’s rule counts honest', () => {
    // The homepage panel states which ruleset it ran and how many rules that
    // is. Those numbers are marketing copy sitting next to a verdict, so they
    // have to track the engine rather than drift into round numbers.
    expect(en.showcase.check.rulesetLine).toContain(String(RULE_COUNTS.en16931));
    expect(en.showcase.automate.snippet).toContain(`${RULE_COUNTS.en16931} rules run`);
    // The German page demonstrates the German profile, so it cites 56.
    expect(de.showcase.check.rulesetLine).toContain(String(RULE_COUNTS.xrechnung));
    expect(de.showcase.automate.snippet).toContain(`${RULE_COUNTS.xrechnung} rules run`);
  });

  it('states the showcase arithmetic correctly in both languages', () => {
    // A worked example on the homepage that does not add up would be the
    // single most embarrassing bug this product could ship.
    expect(en.showcase.check.problems[0]?.detail).toContain('20% of £2,450.00 is £490.00');
    expect(de.showcase.check.problems[0]?.detail).toContain('19 % von 2.450,00 € sind 465,50 €');
  });

  it('turns away a dropped PDF instead of filling the box with binary', () => {
    // The homepage advertises "CII · ZUGFeRD / Factur-X", and ZUGFeRD *is* a
    // PDF — so someone will drop one here. File.text() does not reject on a
    // PDF: it resolves with mojibake, so the old catch never fired and the
    // user got a raw parse error that reads like a broken product.
    const pdf = describeUnreadableDrop({ name: 'rechnung.pdf', type: 'application/pdf' });
    expect(pdf).toMatch(/ZUGFeRD or Factur-X/);
    expect(pdf).toMatch(/embedded inside/);
    // Caught by extension too — a PDF saved with no MIME type is still a PDF.
    expect(describeUnreadableDrop({ name: 'Rechnung.PDF', type: '' })).toBeTruthy();
    expect(describeUnreadableDrop({ name: 'scan.png', type: 'image/png' })).toMatch(/PNG/);
    // And real invoice XML still goes straight through.
    expect(describeUnreadableDrop({ name: 'invoice.xml', type: 'text/xml' })).toBeNull();
    expect(describeUnreadableDrop({ name: 'pasted', type: '' })).toBeNull();
  });

  it('keeps the rule families adding up to the totals quoted elsewhere', () => {
    // The showcase says "EN 16931 · 40 rules" while this card breaks the same
    // engine into three families. If they do not sum, the page contradicts
    // itself — on the one page whose pitch is that every number is checkable.
    const [core, vat, german] = RULE_FAMILIES;
    expect(core + vat).toBe(RULE_COUNTS.en16931);
    expect(core + vat + german).toBe(RULE_COUNTS.xrechnung);
  });

  it('gives every showcase tab a panel to render', () => {
    for (const copy of [en, de]) {
      expect(copy.showcase.tabs.map((t) => t.id).sort()).toEqual([
        'automate',
        'check',
        'create',
        'fix',
      ]);
    }
  });
});

describe('rate limiter (in-memory fallback)', () => {
  it('allows up to the limit then blocks within the window', async () => {
    const key = `test:${Math.random()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(key, 3, 60_000));
    expect(results[0]?.allowed).toBe(true);
    expect(results[2]?.allowed).toBe(true);
    expect(results[3]?.allowed).toBe(false);
    expect(results[3]?.remaining).toBe(0);
  });

  it('scopes windows per key', async () => {
    const a = await rateLimit(`a:${Math.random()}`, 1, 60_000);
    const b = await rateLimit(`b:${Math.random()}`, 1, 60_000);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});
