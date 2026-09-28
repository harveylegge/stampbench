/**
 * The Stampbench assistant — the paid-only chat endpoint's pure parts.
 *
 * Validation and the system prompt live here so the web test suite can pin
 * them; the route, the plan gate and the metering stay in index.ts. The gate
 * matters: the existing 'ai' meter gives Free five calls a month for explain/
 * draft, so the chat route must refuse free-plan sessions itself — the meter
 * alone would not keep the assistant paid-only.
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Bounds chosen to keep a turn cheap: history is context, not an archive. */
export const CHAT_MAX_TURNS = 24;
export const CHAT_MAX_CHARS = 4_000;

/**
 * The client's message history, checked and clipped, or null when the shape
 * is not a conversation we can send upstream. Alternation is not required —
 * only that every entry is a well-formed turn and the last word belongs to
 * the user. Over-long histories lose their OLDEST turns: the question being
 * asked now matters more than how the conversation began.
 */
export function sanitizeChatTurns(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const turns: ChatTurn[] = [];
  for (const entry of raw) {
    const item = (entry ?? {}) as Record<string, unknown>;
    if (item.role !== 'user' && item.role !== 'assistant') return null;
    if (typeof item.content !== 'string') return null;
    const content = item.content.trim().slice(0, CHAT_MAX_CHARS);
    if (!content) return null;
    turns.push({ role: item.role, content });
  }
  const clipped = turns.slice(-CHAT_MAX_TURNS);
  if (clipped[clipped.length - 1]!.role !== 'user') return null;
  return clipped;
}

/**
 * What the assistant knows and how it behaves. Product facts only — anything
 * here is effectively public copy, so nothing secret, and nothing that could
 * become a compliance claim. The no-legal-advice line mirrors the footer's.
 */
export function chatSystemPrompt(planName: string): string {
  return [
    'You are the Stampbench assistant, built into stampbench.com — an e-invoicing service.',
    'What Stampbench offers: a free browser invoice generator (invoices never leave the browser unless account backup is switched on); validation and repair of EN 16931 / XRechnung e-invoices (free, unlimited, local); My Invoices with payment tracking, overdue view, recurring invoices, a customer book and chase emails; a hosted API, TypeScript library (@stampbench/core) and CLI for developers; and auto-invoicing — paid accounts can generate a payment webhook URL on the Account page, point PayPal, Stripe or anything that POSTs JSON at it, and incoming payments mark invoices paid or create drafts automatically.',
    'Plans: Free; Developer £29/mo; Agency £99/mo; Platform £299/mo — details at /pricing. The user you are talking to is on the ' + planName + ' plan.',
    'Your scope: help with e-invoicing (EN 16931, XRechnung, UBL, CII, Peppol, VAT fields), with using Stampbench itself, and with running small-business invoicing on it. If asked something unrelated, say briefly that you are the invoicing assistant and steer back.',
    'Rules: be concise and concrete. Answer in the language the user writes (English and German both fine). Never invent field values, VAT rates or legal thresholds you are not sure of — say so instead. You are not a lawyer or tax advisor and must say that when a question needs one. Do not promise features that do not exist.',
  ].join('\n');
}
