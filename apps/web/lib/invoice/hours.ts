/**
 * Hours-to-invoice: a time log in, grouped line items out.
 *
 * Deliberately mechanical. It parses what tools export (Toggl-style CSV, or
 * a pasted "3.5h fixing the deploy" log), groups by project — or by matching
 * description when there is no project column — and sums the hours in code.
 * It does not rephrase, merge "similar-looking" work, or guess: an importer
 * that quietly changed what 40 entries said would be editing the user's
 * timesheet, and the arithmetic on an invoice must come from arithmetic.
 *
 * Everything runs in the browser; the log never leaves it.
 */

export interface HoursEntry {
  /** Project/client column when the source had one; '' otherwise. */
  project: string;
  description: string;
  hours: number;
}

export interface HoursGroup {
  description: string;
  /** Summed and rounded to 2 dp — quantity precision, not payroll precision. */
  hours: number;
  entries: number;
}

export interface ParsedHours {
  entries: HoursEntry[];
  /** Lines that had no readable duration. Reported, never silently dropped. */
  skipped: number;
  /** Lines beyond the entry cap. Also reported — the cap must not lie either. */
  truncated: number;
}

/** Hard ceiling so a pasted year of exports cannot hang the tab. */
const MAX_ENTRIES = 1_000;

/**
 * "1:30", "1.5", "1,5", "90m", "2h 15m", "3.5h" → hours. Null when the text
 * is not a duration — the caller decides whether that skips a line or a cell.
 */
export function parseDuration(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  let m = /^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/.exec(s);
  if (m) return +m[1]! + +m[2]! / 60 + (m[3] ? +m[3]! / 3600 : 0);

  m = /^(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hours?|std\.?)?$/i.exec(s);
  if (m) return parseFloat(m[1]!.replace(',', '.'));

  m = /^(?:(\d+)\s*h(?:ours?|rs?)?\.?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?\.?)?$/i.exec(s);
  if (m && (m[1] || m[2])) return +(m[1] ?? 0) + +(m[2] ?? 0) / 60;

  return null;
}

/** One CSV line, honouring double quotes. Enough for time-tracker exports. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      fields.push(current);
      current = '';
    } else current += ch;
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

/** Column index whose header matches one of the names; -1 when none does. */
function findColumn(headers: string[], names: string[]): number {
  return headers.findIndex((h) => names.includes(h.toLowerCase().trim()));
}

const DESCRIPTION_COLUMNS = ['description', 'task', 'notes', 'note', 'title', 'entry', 'activity', 'beschreibung'];
const PROJECT_COLUMNS = ['project', 'client', 'job', 'projekt', 'kunde'];
const DURATION_COLUMNS = ['duration', 'hours', 'time', 'hrs', 'h', 'decimal hours', 'duration (h)', 'dauer', 'stunden'];

/**
 * Leading bullet points and dates are log furniture, not billable words.
 * "2026-08-12: fixed the deploy" and "- fixed the deploy" both bill as
 * "fixed the deploy".
 */
function cleanDescription(raw: string): string {
  return raw
    .replace(/^[\s\-–—•*>·]+/, '')
    .replace(/^\d{4}-\d{2}-\d{2}[\s:,–—-]*/, '')
    .replace(/^\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?[\s:,–—-]*/, '')
    .replace(/[\s\-–—:,;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a pasted log. CSV when the first line looks like a time-tracker
 * header with a duration column; otherwise line-by-line text, where each
 * line needs a duration ("3.5h", "1:30", "45m") somewhere in it.
 */
export function parseHoursLog(text: string): ParsedHours {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return { entries: [], skipped: 0, truncated: 0 };

  // CSV detection: a delimiter that appears in the first line, whose header
  // row names a duration column. Anything else is treated as prose.
  const header = lines[0]!;
  for (const delimiter of [',', ';', '\t']) {
    if (!header.includes(delimiter)) continue;
    const headers = splitCsvLine(header, delimiter);
    const durationCol = findColumn(headers, DURATION_COLUMNS);
    if (durationCol === -1) continue;

    const descriptionCol = findColumn(headers, DESCRIPTION_COLUMNS);
    const projectCol = findColumn(headers, PROJECT_COLUMNS);
    const entries: HoursEntry[] = [];
    let skipped = 0;
    let truncated = 0;
    for (let i = 1; i < lines.length; i++) {
      if (entries.length >= MAX_ENTRIES) {
        truncated = lines.length - i;
        break;
      }
      const fields = splitCsvLine(lines[i]!, delimiter);
      const hours = parseDuration(fields[durationCol] ?? '');
      if (hours === null || hours <= 0) {
        skipped++;
        continue;
      }
      entries.push({
        project: projectCol === -1 ? '' : (fields[projectCol] ?? ''),
        description:
          cleanDescription(descriptionCol === -1 ? '' : (fields[descriptionCol] ?? '')) || 'Work',
        hours,
      });
    }
    return { entries, skipped, truncated };
  }

  // Plain text: find the duration in each line; the rest is the work. Order
  // matters — a clock range ("9:00-10:30") and a compound ("2h 15m") both
  // contain tokens the simpler patterns would happily half-match, so the
  // specific shapes go first and the leftovers never masquerade as hours.
  const entries: HoursEntry[] = [];
  let skipped = 0;
  let truncated = 0;
  for (let i = 0; i < lines.length; i++) {
    if (entries.length >= MAX_ENTRIES) {
      truncated = lines.length - i;
      break;
    }
    const line = lines[i]!;
    let hours: number | null = null;
    let matched = '';

    const range = /(\d{1,2}):([0-5]\d)\s*[-–—]\s*(\d{1,2}):([0-5]\d)/.exec(line);
    const compound = /(?<![\d.,])(\d+\s*h(?:ours?|rs?)?\.?\s*\d+\s*m(?:in(?:ute)?s?)?)\.?\b/i.exec(line);
    const clock = /(\d{1,3}:[0-5]\d)\b/.exec(line);
    const hoursOnly = /(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hours?|std)\b\.?/i.exec(line);
    const minutesOnly = /(\d+)\s*m(?:in(?:ute)?s?)?\b\.?/i.exec(line);

    if (range) {
      // "9:00-10:30" is a span, and a span is arithmetic: end minus start,
      // rolling over midnight for the late-deploy crowd.
      const start = +range[1]! + +range[2]! / 60;
      const end = +range[3]! + +range[4]! / 60;
      hours = end - start;
      if (hours < 0) hours += 24;
      matched = range[0];
    } else if (compound) {
      hours = parseDuration(compound[1]!);
      matched = compound[0];
    } else if (clock) {
      hours = parseDuration(clock[1]!);
      matched = clock[0];
    } else if (hoursOnly) {
      hours = parseFloat(hoursOnly[1]!.replace(',', '.'));
      matched = hoursOnly[0];
    } else if (minutesOnly) {
      hours = +minutesOnly[1]! / 60;
      matched = minutesOnly[0];
    }

    // A single log line claiming more than a day is a mis-read timestamp,
    // not a shift — skipping it loudly beats billing it quietly.
    if (hours === null || hours <= 0 || hours > 24) {
      skipped++;
      continue;
    }
    const description = cleanDescription(line.replace(matched, ' '));
    entries.push({ project: '', description: description || 'Work', hours });
  }
  return { entries, skipped, truncated };
}

/**
 * Group by project when the export had one, else by identical description
 * (case- and whitespace-insensitive). Biggest first, because the invoice
 * should lead with the work that cost the most time.
 */
export function groupHours(entries: HoursEntry[]): HoursGroup[] {
  const groups = new Map<string, { description: string; hours: number; entries: number }>();
  for (const entry of entries) {
    const key = entry.project.trim()
      ? `p:${entry.project.trim().toLowerCase()}`
      : `d:${entry.description.toLowerCase()}`;
    let group = groups.get(key);
    if (!group) {
      group = { description: entry.project.trim() || entry.description, hours: 0, entries: 0 };
      groups.set(key, group);
    }
    group.hours += entry.hours;
    group.entries += 1;
  }
  return [...groups.values()]
    .map((g) => ({ ...g, hours: Math.round(g.hours * 100) / 100 }))
    .sort((a, b) => b.hours - a.hours);
}
