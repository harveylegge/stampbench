import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { createApiKey, revokeApiKey } from '@/lib/api-keys';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api';
import { log } from '@/lib/log';

export const runtime = 'nodejs';

const MAX_ACTIVE_KEYS = 10;

/** POST /api/keys { name } → { key (plaintext, shown once), id, prefix } */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, 'unauthenticated', 'Sign in first.');

  let name = 'Default';
  try {
    const body = z.object({ name: z.string().trim().min(1).max(60) }).safeParse(await request.json());
    if (body.success) name = body.data.name;
  } catch {
    // empty body is fine — use default name
  }

  const activeCount = await db.apiKey.count({ where: { userId: user.id, revokedAt: null } });
  if (activeCount >= MAX_ACTIVE_KEYS) {
    return apiError(400, 'too_many_keys', `Maximum ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
  }

  const { key, record } = await createApiKey(user.id, name);
  log.info('apikey.created', { userId: user.id, keyId: record.id });
  return NextResponse.json({
    key, // plaintext — returned exactly once
    id: record.id,
    prefix: record.prefix,
    name: record.name,
  });
}

/** DELETE /api/keys { id } — revoke a key. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, 'unauthenticated', 'Sign in first.');
  let id: string;
  try {
    const body = z.object({ id: z.string().min(1) }).parse(await request.json());
    id = body.id;
  } catch {
    return apiError(400, 'invalid_request', 'Send {"id": "<keyId>"}.');
  }
  await revokeApiKey(user.id, id);
  log.info('apikey.revoked', { userId: user.id, keyId: id });
  return NextResponse.json({ ok: true });
}
