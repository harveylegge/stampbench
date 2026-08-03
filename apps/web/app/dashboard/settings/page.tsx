import { requireUser } from '@/lib/auth';
import { logoutAction } from '@/app/(auth)/actions';
import { deleteAccountAction } from './actions';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mb-8 text-sm text-muted">Account details and session.</p>

      <div className="mb-6 rounded-xl border border-border bg-surface p-5 text-sm">
        <dl className="grid grid-cols-[8rem_1fr] gap-y-3">
          <dt className="text-muted">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted">Name</dt>
          <dd>{user.name ?? '—'}</dd>
          <dt className="text-muted">Member since</dt>
          <dd>{user.createdAt.toLocaleDateString()}</dd>
          <dt className="text-muted">Role</dt>
          <dd className="capitalize">{user.role}</dd>
        </dl>
      </div>

      <div className="mb-6">
        <form action={logoutAction}>
          <button className="rounded-lg border border-border bg-surface px-4 py-2 text-sm transition hover:border-border-hi">
            Sign out
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-danger/30 bg-danger/5 p-5">
        <h2 className="mb-1 text-sm font-medium text-danger">Danger zone</h2>
        <p className="mb-4 text-sm text-muted">
          Deletes your account, API keys, and usage history permanently. Active subscriptions
          should be cancelled in Billing first.
        </p>
        <form action={deleteAccountAction}>
          <button className="rounded-lg border border-danger/40 px-4 py-2 text-sm text-danger transition hover:bg-danger/10">
            Delete my account
          </button>
        </form>
      </div>
    </div>
  );
}
