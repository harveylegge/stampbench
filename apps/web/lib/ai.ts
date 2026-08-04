import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { Violation } from '@stampbench/core';
import { env, features } from './env';
import { log } from './log';

/**
 * Turns raw rule violations ("BR-DE-15: …") into a plain-language fix plan.
 * With ANTHROPIC_API_KEY set it uses Claude; without it, a deterministic
 * template still produces genuinely useful output so the feature never 404s.
 */

const SYSTEM_PROMPT = `You are Stampbench's e-invoicing compliance assistant. You explain EN 16931 / XRechnung validation errors to developers.

Rules:
- Explain what each violated rule means in practice and exactly how to fix it, referencing the field names the developer will see (both the business term like BT-10 and the human name like "buyer reference").
- Be concrete: show example values where helpful (e.g. a Leitweg-ID looks like "04011000-1234512345-06").
- Order fixes by importance: blocking errors first, then warnings.
- Keep it tight — a short intro sentence, then a numbered fix list. No filler, no disclaimers.
- If violations reference German requirements, briefly note why Germany requires it when that helps understanding.
- You are advising on developer tooling output, not giving legal advice; do not add legal disclaimers, the product UI already carries one.`;

export interface ExplainResult {
  explanation: string;
  source: 'claude' | 'fallback';
}

function deterministicExplanation(violations: Violation[]): string {
  const errors = violations.filter((v) => v.severity === 'error');
  const warnings = violations.filter((v) => v.severity === 'warning');
  const lines: string[] = [];
  lines.push(
    `Found ${errors.length} blocking error${errors.length === 1 ? '' : 's'} and ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`,
    '',
  );
  let i = 1;
  for (const v of [...errors, ...warnings]) {
    const terms = v.terms?.length ? ` (${v.terms.join(', ')})` : '';
    lines.push(`${i}. **${v.ruleId}**${terms} — ${v.message}`);
    i++;
  }
  lines.push(
    '',
    '_Configure an Anthropic API key to get AI-written fix suggestions with examples._',
  );
  return lines.join('\n');
}

export async function explainViolations(
  violations: Violation[],
  invoiceContext?: string,
): Promise<ExplainResult> {
  if (!features.liveAi) {
    return { explanation: deterministicExplanation(violations), source: 'fallback' };
  }

  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  // Hard cap the prompt as defense in depth: the route schema already bounds
  // each field, but this guarantees a fixed ceiling on model spend per call
  // regardless of how many violations were sent.
  const MAX_PROMPT_CHARS = 24_000;
  const violationsJson = JSON.stringify(violations, null, 2).slice(0, MAX_PROMPT_CHARS);
  const userContent = [
    'Explain these e-invoice validation results and how to fix them:',
    '',
    violationsJson,
    invoiceContext ? `\nInvoice context (partial): ${invoiceContext.slice(0, 2000)}` : '',
  ].join('\n');

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1500,
      betas: ['server-side-fallback-2026-07-01'],
      // @ts-expect-error — server-side fallbacks param is newer than the SDK typings
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    if (response.stop_reason === 'refusal') {
      log.warn('ai.explain_refusal');
      return { explanation: deterministicExplanation(violations), source: 'fallback' };
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) {
      return { explanation: deterministicExplanation(violations), source: 'fallback' };
    }
    return { explanation: text, source: 'claude' };
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      log.error('ai.explain_api_error', { status: e.status, message: e.message });
    } else {
      log.error('ai.explain_error', { message: (e as Error).message });
    }
    return { explanation: deterministicExplanation(violations), source: 'fallback' };
  }
}
