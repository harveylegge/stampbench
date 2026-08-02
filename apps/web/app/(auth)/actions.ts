'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { destroySession, loginUser, registerUser } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';

export interface AuthFormState {
  error?: string;
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(10, 'Password must be at least 10 characters.').max(200),
  name: z.string().trim().max(80).optional(),
});

async function authRateLimited(): Promise<boolean> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const rl = await rateLimit(`auth:${ip}`, 20, 15 * 60 * 1000);
  return !rl.allowed;
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (await authRateLimited()) return { error: 'Too many attempts. Try again in a few minutes.' };
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const result = await registerUser(parsed.data.email, parsed.data.password, parsed.data.name);
  if ('error' in result) return { error: result.error };
  redirect('/dashboard');
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (await authRateLimited()) return { error: 'Too many attempts. Try again in a few minutes.' };
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email and password are required.' };
  const result = await loginUser(email, password);
  if ('error' in result) return { error: result.error };
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/');
}
