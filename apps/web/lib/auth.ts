import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { cache } from 'react';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { env, insecureProductionSecret } from './env';
import { log } from './log';

const SESSION_COOKIE = 'ig_session';
const SESSION_DAYS = 30;

/** Hash a session token with the server pepper before storage. */
export function hashToken(token: string): string {
  if (insecureProductionSecret()) {
    // Fail loudly rather than run production auth on a known secret.
    throw new Error('SESSION_SECRET must be set in production.');
  }
  return createHash('sha256').update(`${env.sessionSecret}:${token}`).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Constant-time string comparison for secrets already in hex. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  stripeCustomerId: string | null;
  createdAt: Date;
};

/** Resolve the logged-in user from the session cookie. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    stripeCustomerId: user.stripeCustomerId,
    createdAt: user.createdAt,
  };
});

export async function registerUser(email: string, password: string, name?: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: 'An account with this email already exists.' as const };
  const passwordHash = await hashPassword(password);
  // First registered user becomes admin (solo-founder bootstrap); or match ADMIN_EMAIL.
  const userCount = await db.user.count();
  const role = userCount === 0 || (env.adminEmail && email === env.adminEmail) ? 'admin' : 'user';
  const user = await db.user.create({
    data: { email, passwordHash, name: name ?? null, role },
  });
  log.info('user.registered', { userId: user.id, role });
  await createSession(user.id);
  return { user };
}

export async function loginUser(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  // Always run a bcrypt compare so timing doesn't reveal whether the email exists.
  const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await verifyPassword(password, hash);
  if (!user || !ok) return { error: 'Invalid email or password.' as const };
  log.info('user.login', { userId: user.id });
  await createSession(user.id);
  return { user };
}
