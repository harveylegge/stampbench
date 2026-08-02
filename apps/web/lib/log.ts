/**
 * Structured JSON logging. One line per event, machine-parseable, no secrets.
 * Vercel captures stdout/stderr, so this is enough for v1; swap the sink for
 * Axiom/Datadog later without touching call sites.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

function write(level: Level, event: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, data?: Record<string, unknown>) => write('debug', event, data),
  info: (event: string, data?: Record<string, unknown>) => write('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => write('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => write('error', event, data),
};
