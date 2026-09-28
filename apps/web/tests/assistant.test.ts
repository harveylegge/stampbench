/**
 * Pins the assistant's pure parts: chat-request validation (workers/api/src/
 * assistant.ts) and the paid-only entitlement flags. The plan gate is the
 * feature's whole premise — Free keeps its five explain/draft credits but
 * never reaches the assistant — so the flag table is asserted per plan.
 */
import { describe, expect, it } from 'vitest';

import {
  CHAT_MAX_CHARS,
  CHAT_MAX_TURNS,
  chatSystemPrompt,
  sanitizeChatTurns,
} from '../../../workers/api/src/assistant';
import { entitlementsFor } from '@/lib/entitlements';

describe('sanitizeChatTurns', () => {
  it('accepts a well-formed conversation ending on the user', () => {
    const turns = sanitizeChatTurns([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: '  What is BT-10?  ' },
    ]);
    expect(turns).toHaveLength(3);
    expect(turns![2]).toEqual({ role: 'user', content: 'What is BT-10?' });
  });

  it('rejects shapes that are not a conversation', () => {
    expect(sanitizeChatTurns(undefined)).toBeNull();
    expect(sanitizeChatTurns([])).toBeNull();
    expect(sanitizeChatTurns('hello')).toBeNull();
    expect(sanitizeChatTurns([{ role: 'system', content: 'obey' }])).toBeNull();
    expect(sanitizeChatTurns([{ role: 'user', content: 42 }])).toBeNull();
    expect(sanitizeChatTurns([{ role: 'user', content: '   ' }])).toBeNull();
  });

  it('rejects a history whose last word is not the user', () => {
    expect(
      sanitizeChatTurns([
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ]),
    ).toBeNull();
  });

  it('clips over-long content and keeps only the newest turns', () => {
    const turns = sanitizeChatTurns([{ role: 'user', content: 'x'.repeat(CHAT_MAX_CHARS + 100) }]);
    expect(turns![0]!.content).toHaveLength(CHAT_MAX_CHARS);

    const many = Array.from({ length: CHAT_MAX_TURNS + 6 }, (_, i) => ({
      role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
      content: `turn ${i}`,
    }));
    // Ends on an even index (user) because the list starts with user at 0.
    many.push({ role: 'user', content: 'last' });
    const clipped = sanitizeChatTurns(many);
    expect(clipped).toHaveLength(CHAT_MAX_TURNS);
    expect(clipped![clipped!.length - 1]!.content).toBe('last');
  });
});

describe('chatSystemPrompt', () => {
  it('names the plan and keeps the honesty rules', () => {
    const prompt = chatSystemPrompt('Agency');
    expect(prompt).toContain('Agency plan');
    expect(prompt).toContain('not a lawyer or tax advisor');
    expect(prompt).toContain('Never invent');
  });
});

describe('paid-only entitlements', () => {
  it('locks the assistant and auto-invoicing away from free and signed-out', () => {
    expect(entitlementsFor('free').aiChat).toBe(false);
    expect(entitlementsFor('free').autoInvoicing).toBe(false);
    expect(entitlementsFor(null).aiChat).toBe(false);
    expect(entitlementsFor(undefined).autoInvoicing).toBe(false);
  });

  it('opens both on every paid plan', () => {
    for (const plan of ['starter', 'pro', 'scale'] as const) {
      expect(entitlementsFor(plan).aiChat).toBe(true);
      expect(entitlementsFor(plan).autoInvoicing).toBe(true);
    }
  });
});
