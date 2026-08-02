'use server';

import { redirect } from 'next/navigation';
import { destroySession, getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/log';

export async function deleteAccountAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  log.info('user.delete_account', { userId: user.id });
  await destroySession();
  // Cascade removes sessions, API keys, and usage events (see schema).
  await db.user.delete({ where: { id: user.id } });
  redirect('/');
}
