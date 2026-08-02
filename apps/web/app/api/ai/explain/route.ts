import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, gateRequest, readBoundedText } from '@/lib/api';
import { explainViolations } from '@/lib/ai';
import { recordUsage } from '@/lib/usage';

export const runtime = 'nodejs';
export const maxDuration = 60; // Claude call can take a while

const schema = z.object({
  violations: z
    .array(
      z.object({
        ruleId: z.string(),
        severity: z.enum(['error', 'warning']),
        message: z.string(),
        terms: z.array(z.string()).optional(),
        path: z.string().optional(),
        value: z.union([z.string(), z.number()]).optional(),
      }),
    )
    .min(1)
    .max(100),
  invoiceContext: z.string().max(4000).optional(),
});

/** POST /api/ai/explain — plain-language fixes for validation violations. */
export async function POST(request: Request) {
  const gate = await gateRequest(request);
  if (gate instanceof NextResponse) return gate;

  const bodyOrError = await readBoundedText(request);
  if (bodyOrError instanceof NextResponse) return bodyOrError;

  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(JSON.parse(bodyOrError));
  } catch {
    return apiError(400, 'invalid_request', 'Body must be {"violations": [...]} from a validate call.');
  }

  const result = await explainViolations(parsed.violations, parsed.invoiceContext);

  if (gate.caller.type !== 'anon') {
    await recordUsage(gate.caller.userId, 'ai_explain', {
      apiKeyId: gate.caller.type === 'key' ? gate.caller.apiKeyId : null,
    });
  }

  return NextResponse.json(result, { headers: gate.headers });
}
