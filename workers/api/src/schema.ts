/**
 * Cold-start check that the D1 schema this worker was built against is the
 * schema the deployment actually has.
 *
 * The 2026-08-17 near-miss was migration 003 never having been applied on the
 * remote D1: `users.paypal_subscription_id` did not exist, but because every
 * user read uses `SELECT *` the column simply came back undefined. Every code
 * path downstream kept working — login, /account, /pricing — because none of
 * them do anything strict with the value. The failure only surfaced when a
 * live subscribe → webhook → activation loop tried to write it, at which point
 * a buyer would have been charged and left on Free forever.
 *
 * Making that class of miss loud requires one specific defence: verify that
 * the columns the billing paths rely on actually exist, and refuse those paths
 * with a clear "run migration 00X" if they do not. That is what this module
 * does. It is deliberately narrow — schema drift on non-billing tables is not
 * worth failing requests over — and its result is cached per isolate so the
 * pragma is one query at cold-start, not one per request.
 */

/** Columns billing / subscription code reads from `users`. */
export const USERS_BILLING_COLUMNS = [
  'stripe_customer_id',
  'stripe_subscription_id',
  'paypal_subscription_id',
] as const;

export type UsersBillingColumn = (typeof USERS_BILLING_COLUMNS)[number];

/** Migration that first introduced each billing column. */
export const COLUMN_ORIGIN: Record<UsersBillingColumn, string> = {
  stripe_customer_id: '002_security_and_billing.sql',
  stripe_subscription_id: '002_security_and_billing.sql',
  paypal_subscription_id: '003_paypal_subscriptions.sql',
};

export interface SchemaCheck {
  ok: boolean;
  /** Columns from USERS_BILLING_COLUMNS that are absent from the live table. */
  missing: UsersBillingColumn[];
}

/**
 * Pure decision: given the column names D1 reports for `users`, which billing
 * columns are missing? Kept separate from the D1 call so it can be tested
 * without a database.
 */
export function evaluateSchema(presentColumns: Iterable<string>): SchemaCheck {
  const present = new Set(presentColumns);
  const missing = USERS_BILLING_COLUMNS.filter((c) => !present.has(c));
  return { ok: missing.length === 0, missing };
}

/**
 * Human-readable message naming the migration to run for a failed check.
 * Deterministic and de-duplicated so the log line and the HTTP body agree.
 */
export function schemaFailureMessage(check: SchemaCheck): string {
  if (check.ok) return '';
  const files = Array.from(new Set(check.missing.map((c) => COLUMN_ORIGIN[c]))).sort();
  const list = check.missing.map((c) => `users.${c}`).join(', ');
  return `Database schema is behind — missing ${list}. Apply: ${files.join(', ')}.`;
}

// -------------------------------------------------------- D1 adapter + cache

/**
 * One check per isolate. `null` = not yet checked; a Promise while in flight so
 * a burst of first requests share the same query rather than issuing one each.
 */
let cached: Promise<SchemaCheck> | null = null;

/** Test-only: forget the cache so the next call re-queries. */
export function resetSchemaCheckForTests(): void {
  cached = null;
}

interface PragmaColumn {
  name: string;
}

async function readUsersColumns(db: D1Database): Promise<string[]> {
  const rows = await db
    .prepare("SELECT name FROM pragma_table_info('users')")
    .all<PragmaColumn>();
  return (rows.results ?? []).map((r) => r.name).filter((n): n is string => typeof n === 'string');
}

/**
 * Verify the `users` table has every billing column this worker reads. Cached
 * per isolate; if the pragma itself fails (e.g. table missing entirely) the
 * result is `ok: false` with all columns reported missing, which surfaces the
 * same "run the migrations" error rather than a stack trace at the caller.
 */
export async function checkUsersSchema(db: D1Database): Promise<SchemaCheck> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const cols = await readUsersColumns(db);
      return evaluateSchema(cols);
    } catch (e) {
      console.error('schema check failed', e);
      return { ok: false, missing: [...USERS_BILLING_COLUMNS] };
    }
  })();
  const result = await cached;
  // Only cache a *successful* check permanently. A pragma failure on the very
  // first request would otherwise poison the isolate for its whole lifetime,
  // hiding a transient D1 blip as a permanent schema error.
  if (!result.ok && result.missing.length === USERS_BILLING_COLUMNS.length) {
    cached = null;
  }
  return result;
}
