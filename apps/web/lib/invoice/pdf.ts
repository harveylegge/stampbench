'use client';

/**
 * A real, downloadable PDF of the invoice.
 *
 * The print stylesheet is still there for people who genuinely want to print,
 * but "Save as PDF" via the print dialog turned out to be a destination
 * puzzle: anyone whose default printer is a physical one gets paper settings,
 * not a file. This produces an actual .pdf, in the browser, from the same
 * `DraftTotals` the preview and the XML read — one arithmetic, three views.
 *
 * Import this module dynamically (`await import`): jsPDF is a few hundred
 * kilobytes that nobody should pay for until they click the button.
 *
 * Typography is Helvetica in WinAnsi encoding — that covers the £ € ä ö ü ß
 * the supported markets need. Characters outside it degrade, which is the
 * honest trade for a dependency-free, offline PDF.
 */

import { jsPDF } from 'jspdf';
import { formatMoney, toDecimal } from '@stampbench/core';

import { computeDraftTotals } from '@/lib/invoice/build';
import { getCountry } from '@/lib/invoice/countries';
import type { DraftParty, InvoiceDraft } from '@/lib/invoice/draft';
import { getVatCategory } from '@/lib/invoice/tax';
import { fileSlug } from '@/lib/invoice/save-file';

const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = 210 - MARGIN * 2;
const RIGHT = MARGIN + CONTENT_W;
const BOTTOM = PAGE_H - MARGIN;

// Grey levels, matching the site's ink hierarchy.
const INK = 20;
const MUTED = 95;
const FAINT = 135;
const RULE = 225;

/**
 * WinAnsi-safe text. Intl number formatting loves narrow and no-break spaces,
 * and the preview uses a true minus sign — all outside WinAnsi, all rendered
 * as garbage by the standard PDF fonts unless swapped here.
 */
function clean(value: string): string {
  return value
    .replace(/[\u202f\u00a0\u2009\u2007\u2005\u2008]/g, ' ')
    .replace(/−/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

/** Decode any browser-displayable logo into PNG for jsPDF, with dimensions. */
async function rasterisedLogo(dataUrl: string): Promise<{ png: string; w: number; h: number } | null> {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('logo could not be decoded'));
      img.src = dataUrl;
    });
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    if (!w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0);
    return { png: canvas.toDataURL('image/png'), w, h };
  } catch {
    return null;
  }
}

export interface PdfOptions {
  /**
   * Free plans carry a small "Made with stampbench.com" line in the footer;
   * paid plans do not — that is part of what they pay for. Defaults to
   * branded, so an unknown plan can never accidentally hand out the paid look.
   */
  branded?: boolean;
}

export async function invoicePdf(draft: InvoiceDraft, options: PdfOptions = {}): Promise<{ blob: Blob; filename: string }> {
  const totals = computeDraftTotals(draft);
  const currency = draft.document.currency || 'EUR';
  const country = getCountry(draft.seller.countryCode);
  const cash = (m: Parameters<typeof formatMoney>[0]) => clean(formatMoney(m, currency, country.locale));
  const bankLabels =
    country.bank === 'uk'
      ? { account: 'Account number', provider: 'Sort code' }
      : country.bank === 'us'
        ? { account: 'Account number', provider: 'Routing number' }
        : { account: 'IBAN', provider: 'BIC' };

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  let y = MARGIN;

  const ink = (level: number) => doc.setTextColor(level, level, level);
  const style = (size: number, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
  };
  const rule = (at: number, from = MARGIN, to = RIGHT) => {
    doc.setDrawColor(RULE, RULE, RULE);
    doc.setLineWidth(0.2);
    doc.line(from, at, to, at);
  };
  const ensure = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // ------------------------------------------------------------------ header
  const logo = draft.logo ? await rasterisedLogo(draft.logo) : null;
  let leftY = y;
  if (logo) {
    const scale = Math.min(16 / logo.h, 55 / logo.w);
    const w = logo.w * scale;
    const h = logo.h * scale;
    doc.addImage(logo.png, 'PNG', MARGIN, leftY, w, h);
    leftY += h + 4;
  }
  style(13, true);
  ink(INK);
  doc.text(clean(draft.seller.name || 'Your company'), MARGIN, leftY + 4.5);
  leftY += 6.5;
  if (draft.seller.tradingName) {
    style(9);
    ink(MUTED);
    doc.text(clean(`t/a ${draft.seller.tradingName}`), MARGIN, leftY + 3.5);
    leftY += 5;
  }

  style(16, true);
  ink(INK);
  doc.text(draft.document.typeCode === '381' ? 'Credit note' : 'Invoice', RIGHT, y + 5.5, { align: 'right' });
  style(10);
  ink(MUTED);
  doc.text(clean(draft.document.number || '—'), RIGHT, y + 11.5, { align: 'right' });

  y = Math.max(leftY, y + 13) + 8;

  // -------------------------------------------------------- from and bill to
  const party = (p: DraftParty, heading: string, x: number, width: number): number => {
    const c = getCountry(p.countryCode);
    let py = y;
    style(7.5, true);
    ink(FAINT);
    doc.text(heading.toUpperCase(), x, py);
    py += 4.5;
    const lines: { text: string; bold?: boolean; grey?: number }[] = [
      { text: p.name || '—', bold: true },
      ...(p.tradingName ? [{ text: `t/a ${p.tradingName}`, grey: MUTED }] : []),
      ...[
        p.street,
        p.additionalStreet,
        [p.postCode, p.city].filter(Boolean).join(' '),
        p.subdivision,
        c.code ? c.name : '',
      ]
        .filter(Boolean)
        .map((text) => ({ text, grey: MUTED })),
      ...(p.vatId ? [{ text: `VAT: ${p.vatId}`, grey: MUTED }] : []),
      ...(p.taxRegistrationId ? [{ text: `Tax ref: ${p.taxRegistrationId}`, grey: MUTED }] : []),
      ...(p.email ? [{ text: p.email, grey: MUTED }] : []),
    ];
    for (const line of lines) {
      style(9.5, line.bold ?? false);
      ink(line.grey ?? INK);
      for (const wrapped of doc.splitTextToSize(clean(line.text), width) as string[]) {
        doc.text(wrapped, x, py + 3.2);
        py += 4.6;
      }
    }
    return py;
  };
  const colW = CONTENT_W / 2 - 4;
  const fromEnd = party(draft.seller, 'From', MARGIN, colW);
  const billEnd = party(draft.buyer, 'Bill to', MARGIN + CONTENT_W / 2 + 4, colW);
  y = Math.max(fromEnd, billEnd) + 7;

  // ------------------------------------------------------------ document meta
  const metas = [
    ['Issue date', draft.document.issueDate],
    ['Due date', draft.document.dueDate],
    ['Delivery date', draft.document.deliveryDate],
    ['Your reference', draft.document.buyerReference],
    ['Order reference', draft.document.orderReference],
    ['Contract', draft.document.contractReference],
    ['Currency', currency],
  ].filter(([, value]) => value) as [string, string][];
  if (metas.length > 0) {
    rule(y);
    y += 1.5;
    const metaCol = (index: number) => (index % 2 === 0 ? MARGIN : MARGIN + CONTENT_W / 2 + 4);
    const metaRight = (index: number) => (index % 2 === 0 ? MARGIN + CONTENT_W / 2 - 4 : RIGHT);
    metas.forEach(([label, value], index) => {
      const rowY = y + Math.floor(index / 2) * 5.5 + 4;
      style(9);
      ink(FAINT);
      doc.text(label, metaCol(index), rowY);
      ink(INK);
      doc.text(clean(value), metaRight(index), rowY, { align: 'right' });
    });
    y += Math.ceil(metas.length / 2) * 5.5 + 2.5;
    rule(y);
    y += 6;
  }

  // -------------------------------------------------------------- line items
  const DESC_W = 84;
  const col = { qty: MARGIN + 102, unit: MARGIN + 130, vat: MARGIN + 152, net: RIGHT };
  const tableHeader = () => {
    style(7.5, true);
    ink(FAINT);
    doc.text('DESCRIPTION', MARGIN, y);
    doc.text('QTY', col.qty, y, { align: 'right' });
    doc.text('UNIT PRICE', col.unit, y, { align: 'right' });
    doc.text('VAT', col.vat, y, { align: 'right' });
    doc.text('NET', col.net, y, { align: 'right' });
    y += 1.8;
    rule(y);
    y += 4.5;
  };
  tableHeader();

  draft.lines.forEach((line, index) => {
    const total = totals.lines[index];
    const category = getVatCategory(line.vatCategory);
    style(9.5);
    const descLines = doc.splitTextToSize(clean(line.description || '—'), DESC_W) as string[];
    const rowH = descLines.length * 4.4 + (line.sku ? 3.8 : 0) + 3;
    if (y + rowH > BOTTOM) {
      doc.addPage();
      y = MARGIN;
      tableHeader();
    }
    ink(INK);
    descLines.forEach((text, i) => doc.text(text, MARGIN, y + i * 4.4));
    if (line.sku) {
      style(7.5);
      ink(FAINT);
      doc.text(clean(line.sku), MARGIN, y + descLines.length * 4.4);
    }
    style(9.5);
    ink(MUTED);
    doc.text(clean(line.quantity || '—'), col.qty, y, { align: 'right' });
    doc.text(clean(line.unitPrice || '—'), col.unit, y, { align: 'right' });
    doc.text(
      category.rate === 'absent' ? category.code : `${line.vatRate || 0}% ${category.code}`,
      col.vat,
      y,
      { align: 'right' },
    );
    ink(INK);
    doc.text(total ? cash(total.net) : '—', col.net, y, { align: 'right' });
    y += rowH - 1.2;
    rule(y, MARGIN, RIGHT);
    y += 4.2;
  });

  // ------------------------------------------------------------------ totals
  const TOTAL_W = 72;
  const tx = RIGHT - TOTAL_W;
  const totalRows: { label: string; value: string; bold?: boolean; topRule?: boolean }[] = [
    { label: 'Subtotal', value: cash(totals.net) },
    ...totals.categories.map((group) => {
      const category = getVatCategory(group.categoryCode);
      return {
        label:
          category.rate === 'absent'
            ? category.label
            : `${category.code === 'S' ? 'VAT' : category.label} ${group.rate ?? 0}%`,
        value: cash(group.tax),
      };
    }),
    ...(totals.allowances.units !== 0 ? [{ label: 'Discount', value: `-${cash(totals.allowances)}` }] : []),
    ...(totals.charges.units !== 0 ? [{ label: 'Shipping', value: cash(totals.charges) }] : []),
    { label: 'Total', value: cash(totals.gross), bold: true, topRule: true },
    ...(totals.paid.units !== 0
      ? [
          { label: 'Amount paid', value: `-${cash(totals.paid)}` },
          { label: 'Balance due', value: cash(totals.balance), bold: true, topRule: true },
        ]
      : []),
  ];
  ensure(totalRows.length * 5.5 + 14);
  y += 1;
  for (const row of totalRows) {
    if (row.topRule) {
      rule(y - 1.5, tx, RIGHT);
      y += 1;
    }
    style(row.bold ? 10.5 : 9.5, row.bold ?? false);
    ink(row.bold ? INK : MUTED);
    doc.text(clean(row.label), tx, y + 3);
    ink(INK);
    doc.text(row.value, RIGHT, y + 3, { align: 'right' });
    y += row.bold ? 6.2 : 5.2;
  }
  // A wholly untaxed document states why, same as the preview.
  if (toDecimal(totals.tax) === 0 && totals.categories.length > 0) {
    const code = totals.categories[0]!.categoryCode;
    const reason = draft.exemptionReasons[code];
    const note = clean(`${getVatCategory(code).label}${reason ? ` — ${reason}` : ''}`);
    style(7.5);
    ink(FAINT);
    for (const wrapped of doc.splitTextToSize(note, TOTAL_W) as string[]) {
      doc.text(wrapped, tx, y + 3);
      y += 3.6;
    }
  }
  y += 7;

  // ------------------------------------------------- payment, terms and note
  const hasPayment = Boolean(draft.payment.accountId);
  const hasTerms = Boolean(draft.document.paymentTerms);
  if (hasPayment || hasTerms) {
    ensure(30);
    rule(y);
    y += 5.5;
    const blockTop = y;
    let payEnd = y;
    if (hasPayment) {
      style(7.5, true);
      ink(FAINT);
      doc.text('PAYMENT', MARGIN, payEnd);
      payEnd += 4.5;
      style(9.5);
      ink(MUTED);
      const paymentLines = [
        ...(draft.payment.accountName ? [draft.payment.accountName] : []),
        `${bankLabels.account}: ${draft.payment.accountId}`,
        ...(draft.payment.providerId ? [`${bankLabels.provider}: ${draft.payment.providerId}`] : []),
        ...(draft.payment.remittance ? [`Reference: ${draft.payment.remittance}`] : []),
      ];
      for (const line of paymentLines) {
        doc.text(clean(line), MARGIN, payEnd + 3.2);
        payEnd += 4.6;
      }
    }
    let termsEnd = blockTop;
    if (hasTerms) {
      const x = hasPayment ? MARGIN + CONTENT_W / 2 + 4 : MARGIN;
      const width = hasPayment ? colW : CONTENT_W;
      style(7.5, true);
      ink(FAINT);
      doc.text('TERMS', x, termsEnd);
      termsEnd += 4.5;
      style(9.5);
      ink(MUTED);
      for (const wrapped of doc.splitTextToSize(clean(draft.document.paymentTerms), width) as string[]) {
        doc.text(wrapped, x, termsEnd + 3.2);
        termsEnd += 4.6;
      }
    }
    y = Math.max(payEnd, termsEnd) + 6;
  }

  if (draft.document.note) {
    ensure(16);
    rule(y);
    y += 5;
    style(9.5);
    ink(MUTED);
    for (const wrapped of doc.splitTextToSize(clean(draft.document.note), CONTENT_W) as string[]) {
      ensure(5);
      doc.text(wrapped, MARGIN, y + 3.2);
      y += 4.6;
    }
  }

  if (options.branded !== false) {
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      style(7);
      ink(FAINT);
      doc.text('Made with stampbench.com', RIGHT, PAGE_H - 7, { align: 'right' });
    }
  }

  return {
    blob: doc.output('blob'),
    filename: `${fileSlug(draft.document.number)}.pdf`,
  };
}
