/**
 * Minimal ambient declarations for the Cloudflare runtime bindings this worker
 * uses.
 *
 * Hand-written rather than depending on `@cloudflare/workers-types`: the
 * worker is bundled by esbuild, which strips types without checking them, so
 * before this file existed the whole worker — including the billing and
 * session code — was never typechecked at all. Adding a dependency to fix that
 * would pull a large package into the root install for four interfaces.
 *
 * These describe only the surface actually called. If the worker starts using
 * KV, R2, Durable Objects, or more of the D1 API, prefer switching to the real
 * package over growing this file into a bad copy of it.
 */

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: { changes: number; duration?: number; rows_read?: number; rows_written?: number };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

/** A service binding (here: the mailer worker) and the static-assets binding. */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
