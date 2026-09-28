'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { destroySession, loginUser, registerUser } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { createHash } from 'crypto';
import { env, features } from '@/lib/env';

export interface AuthFormState {
  error?: string;
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(10, 'Password must be at least 10 characters.').max(200),
  name: z.string().trim().max(80).optional(),
});

async function authRateLimited(email?: string): Promise<boolean> {
  // Multiple serverless instances cannot safely share the in-memory fallback.
  // Refuse authentication in production until the distributed limiter exists.
  if (env.isProd && !features.distributedRateLimit) return true;
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const ipKey = createHash('sha256').update(`${env.sessionSecret}:${ip}`).digest('hex').slice(0, 24);
  const [broad, credential] = await Promise.all([
    rateLimit(`auth:ip:${ipKey}`, 30, 15 * 60 * 1000),
    email
      ? rateLimit(`auth:credential:${ipKey}:${createHash('sha256').update(email).digest('hex').slice(0, 16)}`, 6, 15 * 60 * 1000)
      : Promise.resolve({ allowed: true }),
  ]);
  return !broad.allowed || !credential.allowed;
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') || undefined,
  });
  if (formData.get('termsAccepted') !== 'yes') return { error: 'Agree to the Terms and Privacy Policy to create an account.' };
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  if (await authRateLimited(parsed.data.email)) return { error: 'Too many attempts. Try again in a few minutes.' };
  const result = await registerUser(parsed.data.email, parsed.data.password, parsed.data.name, '2026-09-28');
  if ('error' in result) return { error: result.error };
  redirect('/dashboard');
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email and password are required.' };
  if (await authRateLimited(email)) return { error: 'Too many attempts. Try again in a few minutes.' };
  const result = await loginUser(email, password);
  if ('error' in result) return { error: result.error };
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/');
}
