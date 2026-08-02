import { NextResponse } from 'next/server';
import { validateUblXml, RULESET_VERSION } from '@invoicegate/core';
import { apiError, gateRequest, readBoundedText } from '@/lib/api';
import { recordUsage } from '@/lib/usage';
import { log } from '@/lib/log';

export const runtime = 'nodejs';

/**
 * POST /api/v1/validate
 *
 * Accepts either:
 *  - application/json: { "xml": "<Invoice …>", "profile": "xrechnung" | "en16931" }
 *  - application/xml or text/xml: the raw UBL document, profile via ?profile=
 *
 * Auth: `Authorization: Bearer ig_live_…` (or x-api-key). Anonymous trial
 * calls are allowed with a low hourly IP limit.
 */
export async function POST(request: Request) {
  const gate = await gateRequest(request);
  if (gate instanceof NextResponse) return gate;

  const bodyOrError = await readBoundedText(request);
  if (bodyOrError instanceof NextResponse) return bodyOrError;
  const body = bodyOrError;

  const contentType = request.headers.get('content-type') ?? '';
  let xml: string;
  let profile: 'xrechnung' | 'en16931' = 'xrechnung';

  if (contentType.includes('json')) {
    try {
      const parsed = JSON.parse(body) as { xml?: unknown; profile?: unknown };
      if (typeof parsed.xml !== 'string' || !parsed.xml.trim()) {
        return apiError(400, 'invalid_request', 'Body must include a non-empty "xml" string.');
      }
      xml = parsed.xml;
      if (parsed.profile === 'en16931' || parsed.profile === 'xrechnung') profile = parsed.profile;
    } catch {
      return apiError(400, 'invalid_json', 'Body is not valid JSON. Send {"xml": "..."} or post raw XML with Content-Type: application/xml.');
    }
  } else {
    xml = body;
    const qp = new URL(request.url).searchParams.get('profile');
    if (qp === 'en16931' || qp === 'xrechnung') profile = qp;
  }

  if (!xml.trim()) {
    return apiError(400, 'invalid_request', 'Empty document. Send UBL Invoice XML.');
  }

  const started = Date.now();
  const result = validateUblXml(xml, { profile });

  if (gate.caller.type !== 'anon') {
    await recordUsage(gate.caller.userId, 'validate', {
      apiKeyId: gate.caller.type === 'key' ? gate.caller.apiKeyId : null,
      profile,
      ok: result.valid,
    });
  }
  log.info('api.validate', {
    profile,
    valid: result.valid,
    errors: result.errorCount,
    warnings: result.warningCount,
    ms: Date.now() - started,
    callerType: gate.caller.type,
  });

  // Never echo the parsed invoice back by default — keep responses small.
  const { invoice: _invoice, ...rest } = result;
  return NextResponse.json(
    { ...rest, rulesetVersion: RULESET_VERSION },
    { headers: gate.headers },
  );
}
