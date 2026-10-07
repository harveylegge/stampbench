/**
 * Chase emails, written from templates rather than a model.
 *
 * The escalation ladder: friendly nudge, firm reminder, final notice: is
 * three templates per language with the facts filled in. Deliberately not AI:
 * the words in a payment chase are load-bearing (they end up quoted back at
 * you in a dispute), and a template the product's author signed off beats a
 * generation nobody read. The one part that must be *right* rather than
 * *well-put*: UK statutory interest and fixed compensation: is arithmetic,
 * and lives here as arithmetic.
 *
 * Nothing in this module sends anything. It produces a subject and a body;
 * the user owns the send button in their own mail client, which keeps the
 * product out of the deliverability business and the user in charge of their
 * own client relationships.
 */

import { money, type Money } from '@stampbench/core';

export type ChaseTone = 'friendly' | 'firm' | 'final';
export type ChaseLocale = 'en' | 'de';

/**
 * Late Payment of Commercial Debts (Interest) Act 1998, in minor units.
 *
 * Statutory interest is 8% over the Bank of England base rate, per year, on
 * the debt including VAT, counted per day overdue. The fixed compensation is
 * tiered by debt size: £40 under £1,000, £70 to £9,999.99, £100 from £10,000.
 * B2B debts in GBP only: the caller decides whether that applies; this
 * function only does the sums.
 *
 * The base rate moves, so it is an input, not a constant: a hardcoded rate
 * would be quietly wrong within months, which in a document that cites an Act
 * of Parliament is worse than asking.
 */
export interface StatutoryCharges {
  /** The annual percentage actually applied: base + 8. */
  ratePct: number;
  days: number;
  interest: Money;
  compensation: Money;
  /** Debt + interest + compensation. */
  totalDue: Money;
}

export function statutoryCharges(
  gross: Money,
  daysOverdue: number,
  baseRatePct: number,
): StatutoryCharges | null {
  if (daysOverdue <= 0) return null;
  if (!Number.isFinite(baseRatePct) || baseRatePct < 0 || baseRatePct > 25) return null;
  if (gross.units <= 0) return null;

  const ratePct = baseRatePct + 8;
  const unit = 10 ** gross.scale;
  const interestUnits = Math.round((gross.units * (ratePct / 100) * daysOverdue) / 365);
  const compensationUnits =
    (gross.units >= 10_000 * unit ? 100 : gross.units >= 1_000 * unit ? 70 : 40) * unit;

  return {
    ratePct,
    days: daysOverdue,
    interest: money(interestUnits, gross.scale),
    compensation: money(compensationUnits, gross.scale),
    totalDue: money(gross.units + interestUnits + compensationUnits, gross.scale),
  };
}

/** The tone a chase this old should open on. Overridable: it is a dial. */
export function defaultToneFor(daysOverdue: number): ChaseTone {
  if (daysOverdue >= 45) return 'final';
  if (daysOverdue >= 14) return 'firm';
  return 'friendly';
}

export interface ChaseDetails {
  invoiceNumber: string;
  buyerCompany: string;
  /** A contact person if the invoice has one; the greeting uses their first name. */
  contactName: string;
  /** Formatted with its currency ("£1,200.00"), or '' when totals cannot be computed. */
  amount: string;
  /** ISO dates, as the draft stores them. */
  issueDate: string;
  dueDate: string;
  daysOverdue: number;
  sellerName: string;
  /** Pre-formatted statutory figures, only when the user opted in (GBP, B2B). */
  statutory?: {
    interest: string;
    compensation: string;
    totalDue: string;
    ratePct: number;
    days: number;
  } | null;
}

function firstName(details: ChaseDetails): string {
  const contact = (details.contactName ?? '').trim();
  if (contact) return contact.split(/\s+/)[0]!;
  return '';
}

/** '2026-08-21' → '21 August 2026' / '21. August 2026'. Bad input passes through. */
function longDate(iso: string, locale: ChaseLocale): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed) || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Date(parsed).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The email. Plain strings with real names and figures in them: every word
 * here ships verbatim, so the register matters: polite without grovelling,
 * firm without theatre. The final notice cites consequences factually and
 * offers the exit ("if payment has been made…") that lets everyone keep face.
 */
export function chaseEmail(
  tone: ChaseTone,
  locale: ChaseLocale,
  details: ChaseDetails,
): { subject: string; body: string } {
  return locale === 'de' ? germanEmail(tone, details) : englishEmail(tone, details);
}

function englishEmail(tone: ChaseTone, d: ChaseDetails): { subject: string; body: string } {
  const name = firstName(d);
  const greeting = name ? `Hi ${name},` : d.buyerCompany ? `Hello ${d.buyerCompany},` : 'Hello,';
  const amount = d.amount || 'the outstanding amount';
  const due = longDate(d.dueDate, 'en');
  const issued = longDate(d.issueDate, 'en');
  const signoff = d.sellerName ? `\n${d.sellerName}` : '';

  if (tone === 'friendly') {
    return {
      subject: `Friendly reminder: invoice ${d.invoiceNumber}`,
      body: `${greeting}

I hope all is well. Just a gentle nudge about invoice ${d.invoiceNumber} for ${amount}, which was due on ${due}.

These things slip through: if payment is already on its way, please ignore this and thank you.

If anything is missing on my side to get it paid, just let me know.

Best wishes,${signoff}`,
    };
  }

  if (tone === 'firm') {
    // The firm tone states the accrual as a fact rather than a demand: the
    // reader learns the clock is running without being served notice yet.
    const firmStatutory = d.statutory
      ? `

Please note that as a business-to-business debt this invoice has begun accruing statutory interest under the Late Payment of Commercial Debts (Interest) Act 1998: currently ${d.statutory.interest} plus ${d.statutory.compensation} fixed compensation, bringing the total due to ${d.statutory.totalDue}.`
      : '';
    return {
      subject: `Reminder: invoice ${d.invoiceNumber} is ${d.daysOverdue} days overdue`,
      body: `${greeting}

I am following up on invoice ${d.invoiceNumber} for ${amount}, issued on ${issued} and due on ${due}: now ${d.daysOverdue} days overdue.

Could you let me know when payment will be made? If there is an issue with the invoice itself, I would rather hear about it now so we can resolve it quickly.${firmStatutory}

The payment details are on the invoice. I would appreciate payment within the next 7 days.

Kind regards,${signoff}`,
    };
  }

  const statutory = d.statutory
    ? `

As this is a business-to-business debt, I am entitled under the Late Payment of Commercial Debts (Interest) Act 1998 to statutory interest of ${d.statutory.interest} (${d.statutory.ratePct}% per year, ${d.statutory.days} days) plus ${d.statutory.compensation} in fixed compensation: bringing the total now due to ${d.statutory.totalDue}. I would prefer to resolve this without adding those charges.`
    : '';

  return {
    subject: `Final notice: invoice ${d.invoiceNumber}: ${amount} overdue`,
    body: `${greeting}

Despite previous reminders, invoice ${d.invoiceNumber} for ${amount}, due on ${due}, remains unpaid after ${d.daysOverdue} days.

Please arrange payment within 7 days of this email.${statutory}

If payment has been made in the last few days, please disregard this notice: and thank you.

Regards,${signoff}`,
  };
}

function germanEmail(tone: ChaseTone, d: ChaseDetails): { subject: string; body: string } {
  // Formal Sie throughout: this is business correspondence between companies,
  // and a Mahnung that suddenly went informal would read as sarcasm.
  const name = (d.contactName ?? '').trim();
  const greeting = name
    ? `Guten Tag ${name},`
    : d.buyerCompany
      ? `Sehr geehrte Damen und Herren (${d.buyerCompany}),`
      : 'Sehr geehrte Damen und Herren,';
  const amount = d.amount || 'den offenen Betrag';
  const due = longDate(d.dueDate, 'de');
  const signoff = d.sellerName ? `\n${d.sellerName}` : '';

  if (tone === 'friendly') {
    return {
      subject: `Zahlungserinnerung: Rechnung ${d.invoiceNumber}`,
      body: `${greeting}

sicherlich ist es Ihrer Aufmerksamkeit entgangen: Die Rechnung ${d.invoiceNumber} über ${amount}, fällig am ${due}, ist noch offen.

Sollte sich Ihre Zahlung mit dieser Erinnerung überschnitten haben, betrachten Sie diese Nachricht bitte als gegenstandslos.

Mit freundlichen Grüßen${signoff}`,
    };
  }

  if (tone === 'firm') {
    return {
      subject: `Mahnung: Rechnung ${d.invoiceNumber} (${d.daysOverdue} Tage überfällig)`,
      body: `${greeting}

trotz Fälligkeit am ${due} ist die Rechnung ${d.invoiceNumber} über ${amount} weiterhin offen: inzwischen seit ${d.daysOverdue} Tagen.

Bitte begleichen Sie den Betrag innerhalb der nächsten 7 Tage. Sollte es mit der Rechnung selbst ein Problem geben, geben Sie mir bitte kurz Bescheid, damit wir es zügig klären können.

Die Zahlungsdaten finden Sie auf der Rechnung.

Mit freundlichen Grüßen${signoff}`,
    };
  }

  return {
    subject: `Letzte Mahnung: Rechnung ${d.invoiceNumber}`,
    body: `${greeting}

trotz mehrfacher Erinnerung ist die Rechnung ${d.invoiceNumber} über ${amount}, fällig am ${due}, seit ${d.daysOverdue} Tagen unbeglichen.

Bitte zahlen Sie den offenen Betrag innerhalb von 7 Tagen nach Erhalt dieser E-Mail. Die Geltendmachung von Verzugszinsen nach § 288 BGB sowie weiterer Verzugsschäden bleibt vorbehalten.

Sollte Ihre Zahlung zwischenzeitlich erfolgt sein, betrachten Sie diese Mahnung bitte als gegenstandslos.

Mit freundlichen Grüßen${signoff}`,
  };
}
