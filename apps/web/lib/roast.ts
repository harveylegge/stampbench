/**
 * Roast my invoice — a rule engine wearing a smirk.
 *
 * Every check here is a real invoicing mistake that really delays payment;
 * the jokes are the delivery mechanism, not the product. It runs entirely in
 * the browser on pasted text, which is both the privacy story ("roasted
 * locally — we never saw it") and the reason it can be free: there is no
 * per-roast cost to anyone.
 *
 * The humour rules: the joke is always about the invoice, never the person
 * or their prices. Each finding carries several lines and picks one by a
 * stable hash of the input, so different invoices get different jokes but
 * re-roasting the same text never reshuffles — a card someone shares should
 * still say what it said.
 */

export interface RoastFinding {
  id: string;
  /** Points off the score. 3 = they cannot pay you; 2 = they will pay late; 1 = untidy. */
  severity: 1 | 2 | 3;
  emoji: string;
  /** The mistake, straight. */
  title: string;
  /** The mistake, delivered. */
  line: string;
}

export interface RoastResult {
  /** 0–10. Ten means we found nothing, and we looked. */
  score: number;
  /** The headline verdict for the score band. */
  grade: string;
  findings: RoastFinding[];
  /** What the invoice got right — at most two, so praise stays scarce. */
  praise: string[];
}

/** Deterministic 32-bit hash — the joke picker's only source of "randomness". */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface Rule {
  id: string;
  severity: 1 | 2 | 3;
  emoji: string;
  title: string;
  /** True when the invoice HAS the problem. */
  applies: (text: string) => boolean;
  lines: string[];
  /** Shown when the check passes and there is room to say so. */
  praise?: string;
}

const DATE_PATTERN =
  /\d{4}-\d{2}-\d{2}|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\w*\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{2,4})?\b/i;

const RULES: Rule[] = [
  {
    id: 'no-invoice-number',
    severity: 2,
    emoji: '🧾',
    title: 'No invoice number',
    applies: (t) =>
      !/\b(?:invoice|inv|rechnung)(?:s(?:nummer|nr))?[\s#:.–/-]*(?:no|nr|number|#)?[\s#:.–/-]*\d/i.test(t) &&
      !/\bINV[-_/ ]?\d/i.test(t) &&
      !/#\s?\d{2,}/.test(t),
    lines: [
      'Their accountant will file this under "never happened".',
      'When you chase it, you\'ll be chasing "you know, the one".',
      'Numberless. Untraceable. Less an invoice, more a rumour of money owed.',
    ],
    praise: 'It has an invoice number — congratulations, it legally exists.',
  },
  {
    id: 'no-due-date',
    severity: 3,
    emoji: '📅',
    title: 'No due date or payment terms',
    // fällig\w* rather than fällig: compounds like "Fälligkeitsdatum" have a
    // word character after the stem, so a trailing \b there can never match.
    applies: (t) =>
      !/\b(?:due|payable|payment\s+(?:terms|due|by|within)|within\s+\d+\s+days|net\s*\d+|zahlbar|zahlungsziel|fällig\w*)\b/i.test(
        t,
      ),
    lines: [
      'So payment is due… whenever the vibes feel right?',
      'Without a due date this can never be overdue. Congratulations on inventing the eternal invoice.',
      'Bold move — "pay me at some point before we both die" rarely converts.',
    ],
    praise: 'There is an actual due date. The single biggest get-paid-faster lever, pulled.',
  },
  {
    id: 'no-payment-details',
    severity: 3,
    emoji: '🏦',
    title: 'No way to pay',
    // The IBAN pattern tolerates the conventional grouped form ("DE89 3704
    // 0044 …"). "Überweisung" sits outside the \b alternation because JS
    // word boundaries are ASCII-only — \bü can never match after a space.
    applies: (t) =>
      !/\b[A-Z]{2}\d{2}(?:[ .]?[A-Z0-9]){10,30}\b/.test(t) && // IBAN, spaced or compact
      !/\b\d{2}-\d{2}-\d{2}\b/.test(t) && // UK sort code
      !/\b(?:iban|bic|swift|sort\s*code|account\s*(?:no|number|name)|routing|paypal|stripe|revolut|wise|bank\s*(?:transfer|details)|bacs|kontonummer)\b/i.test(
        t,
      ) &&
      !/überweisung|ueberweisung/i.test(t),
    lines: [
      'You would like to be paid, but HOW is a complete mystery. Very escape room.',
      'No bank details anywhere. Are they meant to pay you in exposure?',
      'Not a sort code, IBAN or PayPal link in sight. This isn\'t an invoice, it\'s a donation appeal.',
    ],
    praise: 'Payment details are right there. No excuses survive contact with an IBAN.',
  },
  {
    id: 'vague-lines',
    severity: 2,
    emoji: '🌫️',
    title: 'Vague line items',
    // Fires only when the whole line item IS the vague word (an amount after
    // it is allowed) — "Consulting: API integration, 14 hours" is specific
    // and must pass, "- Consulting — £500" is a shrug and must not.
    applies: (t) =>
      /(^|\n)\s*(?:[-–•*·]\s*)?(?:general\s+)?(?:work|misc|miscellaneous|stuff|things|tasks?|jobs?|various(?:\s+services)?|services|consulting)(?:\s*[-–—:,]?\s*[£$€]?[\d.,]*)?\s*(?=$|\n)/im.test(
        t,
      ) || /\b(?:did\s+(?:some\s+)?(?:work|stuff)|odds\s+and\s+ends)\b/i.test(t),
    lines: [
      '"Work" is not a line item, it\'s a confession.',
      '"Various services" — ah yes, the invoice equivalent of a shrug.',
      'Line items so vague the client will query them just to find out what they bought.',
    ],
  },
  {
    id: 'no-total',
    severity: 2,
    emoji: '🧮',
    title: 'No total',
    applies: (t) =>
      !/\b(?:total|amount\s+due|balance\s+(?:due|owing)|grand\s+total|(?:gesamt|end|zwischen)?summe|(?:gesamt|end|rechnungs)?betrag|gesamt(?:preis)?)\b/i.test(
        t,
      ),
    lines: [
      'You\'ve sent them maths homework, not a bill.',
      'The client should not need a calculator to find out what they owe you.',
      '"Add it up yourself" is a bold payment strategy.',
    ],
  },
  {
    id: 'no-currency',
    severity: 2,
    emoji: '💱',
    title: 'No currency',
    applies: (t) => !/[£$€]|\b(?:GBP|EUR|USD|CHF|SEK|NOK|DKK|PLN)\b/.test(t),
    lines: [
      'Numbers with no currency. Bold — let them pick the cheapest one.',
      'No £, € or $ in sight. 400 what? Dollars? Euros? Bottle caps?',
      'Currency: unspecified. Enjoy being paid 1,200 of something.',
    ],
  },
  {
    id: 'no-dates',
    severity: 2,
    emoji: '🕰️',
    title: 'No dates at all',
    applies: (t) => !DATE_PATTERN.test(t),
    lines: [
      'Not one date on the whole thing. A timeless document — unfortunately, so is the debt.',
      'No dates anywhere. Historians will never know when this invoice was ignored.',
      'Undated. Payable in any century, apparently.',
    ],
  },
  {
    id: 'grovelling',
    severity: 2,
    emoji: '🙇',
    title: 'Too many apologies',
    applies: (t) =>
      (t.match(/\b(?:sorry|apologi[sz]e|no\s+rush|whenever\s+(?:suits|you\s+(?:can|get\s+a\s+chance))|hope\s+(?:that'?s|this\s+is)\s+ok|if\s+(?:possible|that'?s\s+alright))\b/gi) ?? [])
        .length >= 2,
    lines: [
      'Two apologies and a "no rush". It\'s a bill, not a hostage note.',
      '"Whenever suits" — congratulations, you\'ve just signed off on their 90-day payment terms.',
      'This invoice apologises for existing. The client will treat it accordingly.',
    ],
  },
  {
    id: 'no-late-terms',
    severity: 1,
    emoji: '⏳',
    title: 'No late-payment terms',
    applies: (t) => !/\b(?:late\s+(?:fee|payment|charge)|interest|overdue|statutory|verzug)\b/i.test(t),
    lines: [
      'Nothing happens if they pay late — and they can tell.',
      'Day 31 arrives and your invoice just… shrugs.',
      'No consequences mentioned. The due date is more of a mood, then.',
    ],
  },
  {
    id: 'no-vat-word',
    severity: 1,
    emoji: '🧐',
    title: 'No tax line',
    applies: (t) =>
      !/\b(?:vat|tax|ust|mwst|umsatzsteuer|mehrwertsteuer|gst|sales\s+tax|kleinunternehmer|reverse\s+charge|zero[- ]rated|exempt)\b/i.test(
        t,
      ),
    lines: [
      'No VAT, no tax line, no exemption note. Fine if you\'re not registered — chaos if you are.',
      'Tax: unmentioned. HMRC loves a surprise, said no one ever.',
      'Not a whisper about VAT. If you\'re not registered, say so — silence reads as "forgot".',
    ],
  },
];

const GRADES: { min: number; grade: string }[] = [
  { min: 10, grade: 'Dangerously professional. We found nothing, and we looked.' },
  { min: 8, grade: 'Solid. A couple of nitpicks, because that is the job.' },
  { min: 6, grade: 'Decent bones, questionable manners.' },
  { min: 4, grade: 'This invoice needs a word with itself.' },
  { min: 2, grade: 'This invoice is why they "must have missed it".' },
  { min: 0, grade: 'That is not an invoice, that is a request for charity.' },
];

/** Roast the pasted text. Pure and deterministic: same paste, same roast. */
export function roastInvoice(text: string): RoastResult {
  const trimmed = text.trim();
  const seed = hash(trimmed);

  if (trimmed.length < 60) {
    return {
      score: 1,
      grade: GRADES[GRADES.length - 1]!.grade,
      findings: [
        {
          id: 'too-short',
          severity: 3,
          emoji: '📱',
          title: 'Barely there',
          line: 'That is not an invoice, that is a text message. Paste the whole thing — or worse, this IS the whole thing.',
        },
      ],
      praise: [],
    };
  }

  const findings: RoastFinding[] = [];
  const praise: string[] = [];
  for (const rule of RULES) {
    if (rule.applies(trimmed)) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        emoji: rule.emoji,
        title: rule.title,
        line: rule.lines[(seed + hash(rule.id)) % rule.lines.length]!,
      });
    } else if (rule.praise) {
      praise.push(rule.praise);
    }
  }

  // Worst first: the shareable card shows the top three, and the top three
  // should be the ones costing money, not the ones costing style points.
  findings.sort((a, b) => b.severity - a.severity);

  const score = Math.max(0, 10 - findings.reduce((sum, f) => sum + f.severity, 0));
  const grade = GRADES.find((g) => score >= g.min)!.grade;

  return { score, grade, findings, praise: praise.slice(0, 2) };
}
