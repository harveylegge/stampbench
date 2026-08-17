/**
 * Password hashing and session tokens on Workers WebCrypto.
 *
 * PBKDF2-SHA256 at 100k iterations — the maximum Workers allows. If the free
 * plan's CPU ceiling ever rejects this (symptom: 1102 "Worker exceeded CPU
 * time limit" on register/login only), lower ITERATIONS and bump VERSION so
 * old hashes keep verifying under their recorded cost.
 *
 * Sessions are HS256 JWTs in an HttpOnly cookie — no session table, so a
 * signout everywhere requires rotating JWT_SECRET, which is acceptable at
 * this scale.
 */

const ITERATIONS = 100_000;
export const SESSION_COOKIE = 'sb_session';
const SESSION_DAYS = 30;

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

/**
 * Compare two secrets without leaking their contents through timing.
 *
 * A plain `===` on strings returns as soon as it finds a differing byte, so
 * response time reveals how much of a guess was correct — enough to recover a
 * secret byte-by-byte. This always walks the full length. Length itself is not
 * hidden; that is acceptable for fixed-length digests and tokens.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HMAC-SHA256 of `message` under `secret`, hex-encoded. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(message));
  return hex(sig);
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return hex(bits);
}

/** Returns { hash: "v1:<iters>:<hex>", salt: <hex> }. */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await pbkdf2(password, salt, ITERATIONS);
  return { hash: `v1:${ITERATIONS}:${digest}`, salt: hex(salt.buffer) };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSaltHex: string,
): Promise<boolean> {
  const [, itersStr, digest] = storedHash.split(':');
  const iterations = Number(itersStr);
  // A malformed stored hash must fail closed, not throw: verifyPassword is
  // also called against a dummy record to equalise login timing, and an
  // exception there would reintroduce the very timing signal it removes.
  if (!digest || !Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = Uint8Array.from(
    storedSaltHex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? [],
  );
  const candidate = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(candidate, digest);
}

/**
 * A syntactically valid hash record that no password matches.
 *
 * Login verifies against this when the email is unknown, so a missing account
 * costs the same ~100k PBKDF2 iterations as a real one. Without it the
 * response time alone distinguishes registered emails from unregistered ones,
 * which turns a neutral error message into a customer-list oracle.
 */
export const DUMMY_CREDENTIAL = {
  hash: `v1:${ITERATIONS}:${'0'.repeat(64)}`,
  salt: '0'.repeat(32),
} as const;

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signSession(userId: string, email: string, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64url(
    enc.encode(
      JSON.stringify({ sub: userId, email, iat: now, exp: now + SESSION_DAYS * 86_400 }),
    ),
  );
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

export interface Session {
  sub: string;
  email: string;
}

/**
 * Returns the session a token carries, or null for anything else.
 *
 * The whole body is guarded, not just the JSON parse: `fromB64url` calls
 * `atob`, which *throws* on a segment that is not valid base64 (a stray
 * character, or a length ≡ 1 mod 4). A cookie is attacker-supplied and can
 * also just be truncated, so an unguarded decode turned a bad cookie into a
 * 500 on every authenticated route — and /api/auth/me answering 500 instead
 * of 401 leaves the browser stuck: the client only treats 401 as "signed
 * out", so the account page errors rather than offering a sign-in.
 */
export async function verifySession(token: string, secret: string): Promise<Session | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromB64url(parts[2]) as BufferSource,
      enc.encode(`${parts[0]}.${parts[1]}`),
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null;
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, maxAgeSeconds = SESSION_DAYS * 86_400): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

/**
 * Readable-by-JS marker set alongside the real (HttpOnly) session cookie.
 * Carries no secrets — it exists so the nav on every static page can skip the
 * /api/auth/me round-trip for the 99% of visitors who have no session, which
 * matters when a traffic spike lands on the free-tier worker.
 */
export function sessionMarkerCookie(maxAgeSeconds = SESSION_DAYS * 86_400): string {
  return `sb_signed_in=1; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function clearSessionMarkerCookie(): string {
  return `sb_signed_in=; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}
