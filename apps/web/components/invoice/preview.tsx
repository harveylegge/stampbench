'use client';

import { formatMoney, toDecimal } from '@stampbench/core';

import { getCountry } from '@/lib/invoice/countries';
import type { DraftParty, InvoiceDraft } from '@/lib/invoice/draft';
import { getVatCategory } from '@/lib/invoice/tax';
import type { DraftTotals } from '@/lib/invoice/build';

/**
 * The printable document.
 *
 * It is a *view*, never the source of truth. The structured invoice is what
 * gets validated and exported; this is the thing a human reads and a buyer's
 * accounts department files. Keeping that ordering explicit matters, because
 * the failure mode of every "invoice generator" is a beautiful PDF whose
 * numbers were computed separately from the data anyone downstream consumes.
 * Every figure below comes from the same `DraftTotals` the XML is built from.
 *
 * "Download PDF" is the browser's own print-to-PDF, driven by the print
 * stylesheet in globals.css. That is a real, offline, dependency-free PDF —
 * as against shipping a rendering library to claim the feature.
 */
function money(units: { units: number; scale: number }, currency: string, locale: string) {
  return formatMoney(units, currency, locale);
}

function AddressBlock({ party, heading }: { party: DraftParty; heading: string }) {
  const country = getCountry(party.countryCode);
  const lines = [
    party.street,
    party.additionalStreet,
    [party.postCode, party.city].filter(Boolean).join(' '),
    party.subdivision,
    country.code ? country.name : '',
  ].filter(Boolean);

  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{heading}</div>
      <div className="text-sm leading-relaxed">
        <div className="font-medium text-text">{party.name || <span className="text-faint">—</span>}</div>
        {party.tradingName && <div className="text-muted">t/a {party.tradingName}</div>}
        {lines.map((line) => (
          <div key={line} className="text-muted">
            {line}
          </div>
        ))}
        {party.vatId && <div className="mt-1 text-muted">VAT: {party.vatId}</div>}
        {party.taxRegistrationId && <div className="text-muted">Tax ref: {party.taxRegistrationId}</div>}
        {party.email && <div className="text-muted">{party.email}</div>}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-faint">{label}</span>
      <span className="text-right font-medium text-text">{value}</span>
    </div>
  );
}

export function InvoicePreview({ draft, totals }: { draft: InvoiceDraft; totals: DraftTotals }) {
  const currency = draft.document.currency || 'EUR';
  const country = getCountry(draft.seller.countryCode);
  const locale = country.locale;
  const bankLabels =
    country.bank === 'uk'
      ? { account: 'Account number', provider: 'Sort code' }
      : country.bank === 'us'
        ? { account: 'Account number', provider: 'Routing number' }
        : { account: 'IBAN', provider: 'BIC' };

  return (
    <article
      id="invoice-preview"
      className="invoice-paper rounded-xl border border-border bg-surface p-6 text-text sm:p-8"
      aria-label="Invoice preview"
    >
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold tracking-tight">
            {draft.seller.name || <span className="text-faint">Your company</span>}
          </div>
          {draft.seller.tradingName && <div className="text-sm text-muted">t/a {draft.seller.tradingName}</div>}
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold tracking-tight">
            {draft.document.typeCode === '381' ? 'Credit note' : 'Invoice'}
          </div>
          <div className="font-mono text-sm text-muted">{draft.document.number || '—'}</div>
        </div>
      </header>

      <div className="mb-8 grid gap-6 sm:grid-cols-2">
        <AddressBlock party={draft.seller} heading="From" />
        <AddressBlock party={draft.buyer} heading="Bill to" />
      </div>

      <div className="mb-8 grid gap-x-8 gap-y-1 border-y border-border py-3 sm:grid-cols-2">
        <Meta label="Issue date" value={draft.document.issueDate} />
        <Meta label="Due date" value={draft.document.dueDate} />
        <Meta label="Delivery date" value={draft.document.deliveryDate} />
        <Meta label="Your reference" value={draft.document.buyerReference} />
        <Meta label="Order reference" value={draft.document.orderReference} />
        <Meta label="Contract" value={draft.document.contractReference} />
        <Meta label="Currency" value={currency} />
      </div>

      <div className="mb-6 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-faint">
              <th scope="col" className="pb-2 pr-3 font-normal">
                Description
              </th>
              <th scope="col" className="pb-2 px-3 text-right font-normal">
                Qty
              </th>
              <th scope="col" className="pb-2 px-3 text-right font-normal">
                Unit price
              </th>
              <th scope="col" className="pb-2 px-3 text-right font-normal">
                VAT
              </th>
              <th scope="col" className="pb-2 pl-3 text-right font-normal">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((line, index) => {
              const total = totals.lines[index];
              const category = getVatCategory(line.vatCategory);
              return (
                <tr key={line.key} className="border-b border-border/60 align-top">
                  <td className="py-2.5 pr-3">
                    <div className="text-text">{line.description || <span className="text-faint">—</span>}</div>
                    {line.sku && <div className="font-mono text-xs text-faint">{line.sku}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{line.quantity || '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{line.unitPrice || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-muted">
                    {category.rate === 'absent' ? category.code : `${line.vatRate || 0}%`}
                    <span className="ml-1 font-mono text-[11px] text-faint">{category.code}</span>
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums text-text">
                    {total ? money(total.net, currency, locale) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mb-8 flex justify-end">
        <div className="w-full max-w-xs">
          <div className="flex justify-between py-1 text-sm">
            <span className="text-muted">Subtotal</span>
            <span className="tabular-nums">{money(totals.net, currency, locale)}</span>
          </div>
          {totals.categories.map((group) => {
            const category = getVatCategory(group.categoryCode);
            return (
              <div key={`${group.categoryCode}-${group.rate}`} className="flex justify-between py-1 text-sm">
                <span className="text-muted">
                  {category.rate === 'absent'
                    ? category.label
                    : `${category.code === 'S' ? 'VAT' : category.label} ${group.rate ?? 0}%`}
                </span>
                <span className="tabular-nums text-muted">{money(group.tax, currency, locale)}</span>
              </div>
            );
          })}
          {totals.allowances.units !== 0 && (
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted">Discount</span>
              <span className="tabular-nums text-muted">−{money(totals.allowances, currency, locale)}</span>
            </div>
          )}
          {totals.charges.units !== 0 && (
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted">Shipping</span>
              <span className="tabular-nums text-muted">{money(totals.charges, currency, locale)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{money(totals.gross, currency, locale)}</span>
          </div>
          {totals.paid.units !== 0 && (
            <>
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted">Amount paid</span>
                <span className="tabular-nums text-muted">−{money(totals.paid, currency, locale)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Balance due</span>
                <span className="tabular-nums">{money(totals.balance, currency, locale)}</span>
              </div>
            </>
          )}
          {toDecimal(totals.tax) === 0 && totals.categories.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-faint">
              {getVatCategory(totals.categories[0]!.categoryCode).label}
              {draft.exemptionReasons[totals.categories[0]!.categoryCode]
                ? ` — ${draft.exemptionReasons[totals.categories[0]!.categoryCode]}`
                : ''}
            </p>
          )}
        </div>
      </div>

      {(draft.payment.accountId || draft.document.paymentTerms) && (
        <div className="grid gap-6 border-t border-border pt-5 sm:grid-cols-2">
          {draft.payment.accountId && (
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
                Payment
              </div>
              <div className="text-sm leading-relaxed text-muted">
                {draft.payment.accountName && <div>{draft.payment.accountName}</div>}
                <div>
                  {bankLabels.account}: <span className="font-mono">{draft.payment.accountId}</span>
                </div>
                {draft.payment.providerId && (
                  <div>
                    {bankLabels.provider}: <span className="font-mono">{draft.payment.providerId}</span>
                  </div>
                )}
                {draft.payment.remittance && <div>Reference: {draft.payment.remittance}</div>}
              </div>
            </div>
          )}
          {draft.document.paymentTerms && (
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
                Terms
              </div>
              <p className="text-sm leading-relaxed text-muted">{draft.document.paymentTerms}</p>
            </div>
          )}
        </div>
      )}

      {draft.document.note && (
        <p className="mt-5 border-t border-border pt-5 text-sm leading-relaxed text-muted">
          {draft.document.note}
        </p>
      )}
    </article>
  );
}
