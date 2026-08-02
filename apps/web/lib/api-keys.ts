import 'server-only';
import { createHash, randomBytes } from 'crypto';
import { db } from './db';

const KEY_PREFIX = 'ig_live_';

/** API keys are hashed with plain SHA-256 (the key itself is high-entropy). */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const key = `${KEY_PREFIX}${randomBytes(24).toString('hex')}`;
  return { key, prefix: key.slice(0, 15), keyHash: hashApiKey(key) };
}

export async function createApiKey(userId: string, name: string) {
  const { key, prefix, keyHash } = generateApiKey();
  const record = await db.apiKey.create({
    data: { userId, name: name.slice(0, 60) || 'Default', prefix, keyHash },
  });
  // The plaintext key is returned exactly once and never stored.
  return { key, record };
}

export async function revokeApiKey(userId: string, keyId: string) {
  await db.apiKey.updateMany({
    where: { id: keyId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export type ApiKeyAuth = {
  userId: string;
  apiKeyId: string;
  plan: string;
};

/** Resolve a Bearer/`x-api-key` credential to its owner. Null when invalid. */
export async function authenticateApiKey(request: Request): Promise<ApiKeyAuth | null> {
  const header = request.headers.get('authorization');
  const bearer = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
  const key = bearer ?? request.headers.get('x-api-key')?.trim() ?? null;
  if (!key || !key.startsWith(KEY_PREFIX)) return null;
  const record = await db.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    include: { user: { select: { id: true, plan: true } } },
  });
  if (!record || record.revokedAt) return null;
  // Fire-and-forget freshness marker; not worth failing the request over.
  db.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return { userId: record.user.id, apiKeyId: record.id, plan: record.user.plan };
}
