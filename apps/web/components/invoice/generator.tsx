'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@stampbench/core';

import { Flag } from '@/components/flag';
import {
  BUTTON_PRIMARY,
  BUTTON_QUIET,
  BUTTON_SECONDARY,
  DocDetails,
  DocField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/invoice/fields';
 import { AiAssist } from '@/components/invoice/ai-assist';
import { InvoicePreview } from '@/components/invoice/preview';
import { GenerationResult } from '@/components/invoice/result';
import {
  computeDraftTotals,
  generateDocument,
  preflight,
  requirementChecks,
  type GeneratedDocument,
} from '@/lib/invoice/build';
import {
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  getCountry,
  isCrossBorder,
  tradeRelation,
} from '@/lib/invoice/countries';
import {
  emptyDraft,
  MAX_LOGO_BYTES,
  newLine,
  PAYMENT_MEANS_OPTIONS,
  TYPE_CODE_OPTIONS,
  type InvoiceDraft,
} from '@/lib/invoice/draft';
import { formatsForMarket, getFormat, isUsable, rulesetLabelFor, SUPPORT_LABEL } from '@/lib/invoice/formats';
import { applyTemplate, templatesForMarket } from '@/lib/invoice/templates';
import { categoriesFor, getVatCategory, US_TAX_NOTE, type VatCategoryCode } from '@/lib/invoice/tax';
import { readMarket, writeMarket } from '@/lib/market-preference';
import { MARKETS, PAGE_MARKETS, type MarketId } from '@/lib/markets';

/**
 * The invoice generator: market → format → editor → generate → validate →
 * repair → export.
 *
 * Three things drive every design decision in here.
 *
 * **The market is not decoration.** It picks the ruleset, the address fields,
 * the bank fields, the VAT categories on offer and the currency. Changing it
 * mid-invoice therefore changes what the document is, so it asks first rather
 * than silently rewriting someone's work.
 *
 * **Arithmetic happens once.** The summary, the preview and the XML all read
 * the same `DraftTotals`, computed in integer minor units. There is no second
 * code path that could round differently.
 *
 * **Nothing is filled in on the user's behalf.** The compliance checklist
 * shows what the selected profile requires and whether the draft has it, but
 * it never supplies the value — an invented VAT number turns an honest
 * failure into a document that passes while being wrong.
 *
 * Everything runs client-side: the engine is a pure-TypeScript npm package, so
 * an invoice built here never leaves the browser.
 */

const DRAFT_KEY = 'sb_invoice_draft';

type Phase = 'market' | 'format' | 'build' | 'result';

/**
 * Read the saved draft, filling in anything a newer build expects.
 *
 * A draft written by an earlier version of this page is missing whatever has
 * been added since — and the totals code reaches straight into `discount.
 * enabled`, so a stale draft would throw on mount and take the whole editor
 * with it. Merging over a fresh draft costs nothing and means someone's
 * half-finished invoice survives a deploy.
 */
function loadDraft(): InvoiceDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InvoiceDraft>;
    if (!parsed || !Array.isArray(parsed.lines)) return null;
    const base = emptyDraft(parsed.market ?? 'eu', new Date());
    return {
      ...base,
      ...parsed,
      seller: { ...base.seller, ...parsed.seller },
      buyer: { ...base.buyer, ...parsed.buyer },
      shipTo: { ...base.shipTo, ...parsed.shipTo },
      document: { ...base.document, ...parsed.document },
      payment: { ...base.payment, ...parsed.payment },
      tax: { ...base.tax, ...parsed.tax },
      discount: { ...base.discount, ...parsed.discount },
      shipping: { ...base.shipping, ...parsed.shipping },
      exemptionReasons: { ...parsed.exemptionReasons },
      lines: parsed.lines.map((line) => ({ ...newLine(), ...line })),
    };
  } catch {
    return null;
  }
}

function saveDraft(draft: InvoiceDraft | null): void {
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage unavailable. The draft still lives in memory for this session;
    // it simply will not survive a reload, which is the right degradation.
  }
}

// ------------------------------------------------------------------- generator

export function InvoiceGenerator({ initialMarket }: { initialMarket?: MarketId }) {
  const [phase, setPhase] = useState<Phase>('market');
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);
  const [savedDraft, setSavedDraft] = useState<InvoiceDraft | null>(null);
  const [rememberedMarket, setRememberedMarket] = useState<MarketId | null>(null);
  const [pendingMarket, setPendingMarket] = useState<MarketId | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  // Reading storage and today's date has to happen after mount: this component
  // is prerendered into static HTML, and a date or a random line key generated
  // on the server would not match the one generated in the browser.
  useEffect(() => {
    setSavedDraft(loadDraft());
    setRememberedMarket(readMarket());
  }, []);

  useEffect(() => {
    if (draft) saveDraft(draft);
  }, [draft]);

  const startMarket = initialMarket ?? rememberedMarket ?? undefined;

  const update = useCallback((patch: Partial<InvoiceDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const totals = useMemo(() => (draft ? computeDraftTotals(draft) : null), [draft]);
  const checks = useMemo(() => (draft ? requirementChecks(draft) : []), [draft]);
  const format = draft ? getFormat(draft.formatId) : null;

  function chooseMarket(market: MarketId) {
    writeMarket(market);
    setDraft(emptyDraft(market, new Date(), Math.floor(Date.now() / 1000) % 1000000));
    setPhase('format');
  }

  function generate() {
    if (!draft) return;
    const problems = preflight(draft);
    setErrors(problems);
    if (problems.length > 0) return;
    setGenerated(generateDocument(draft));
    setPhase('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------------------------------------------------------------- market step

  if (phase === 'market' || !draft) {
    return (
      <div className="flex flex-col gap-8">
        {savedDraft && (
          <div className="rounded-xl border border-accent/40 bg-accent-dim/40 p-5">
            <h2 className="mb-1 font-medium tracking-tight">You have a saved draft</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              <span className="font-mono">{savedDraft.document.number}</span> for{' '}
              {MARKETS[savedDraft.market].name}, kept in this browser only — it was never uploaded.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setDraft(savedDraft);
                  setPhase('build');
                }}
                className={BUTTON_PRIMARY}
              >
                Continue editing
              </button>
              <button
                onClick={() => {
                  saveDraft(null);
                  setSavedDraft(null);
                }}
                className={BUTTON_SECONDARY}
              >
                Discard it
              </button>
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-2 text-2xl font-semibold tracking-tight">Where is this invoice for?</h2>
          <p className="mb-6 max-w-2xl leading-relaxed text-muted">
            The market decides which ruleset validates the document, which fields the forms ask for, and
            which VAT categories apply. You can change it later.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PAGE_MARKETS.map((id) => {
              const market = MARKETS[id];
              const usable = formatsForMarket(id).filter(isUsable);
              return (
                <button
                  key={id}
                  onClick={() => chooseMarket(id)}
                  className={`group rounded-xl border bg-surface p-5 text-left transition hover:border-border-hi hover:shadow-sm ${
                    startMarket === id ? 'border-accent/50 ring-1 ring-accent/20' : 'border-border'
                  }`}
                >
                  <span className="mb-3 block text-muted">
                    <Flag code={market.flag} size={28} />
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tracking-tight">{market.name}</span>
                    {startMarket === id && (
                      <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[11px] font-medium text-accent-hi">
                        Your market
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">
                    {usable.map((f) => f.name).join(' · ')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold tracking-tight">Or start from an example</h2>
          <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted">
            Realistic data for fictional companies — nothing here belongs to a real business. Every example
            is a working invoice you can generate and validate straight away.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templatesForMarket(startMarket ?? 'eu').map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  const next = applyTemplate(template, new Date(), Math.floor(Date.now() / 1000) % 1000000);
                  writeMarket(next.market);
                  setDraft(next);
                  setPhase('build');
                }}
                className="rounded-xl border border-border bg-surface p-4 text-left transition hover:border-border-hi"
              >
                <span className="mb-2 flex items-center gap-2">
                  <Flag code={MARKETS[template.market].flag} size={20} />
                  <span className="text-sm font-medium tracking-tight">{template.name}</span>
                </span>
                <span className="block text-sm leading-relaxed text-muted">{template.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- format step

  if (phase === 'format') {
    const formats = formatsForMarket(draft.market);
    return (
      <div className="flex flex-col gap-6">
        <div>
          <button onClick={() => setPhase('market')} className={BUTTON_QUIET}>
            ← Change market
          </button>
          <h2 className="mt-3 mb-2 text-2xl font-semibold tracking-tight">
            What should Stampbench produce for {MARKETS[draft.market].name}?
          </h2>
          <p className="max-w-2xl leading-relaxed text-muted">
            Formats Stampbench cannot write are listed too, with the reason. A generator that quietly
            produces the same UBL for every name in the list would be worse than useless on a compliance
            document.
          </p>
        </div>

        <div className="grid gap-3">
          {formats.map((option) => {
            const usable = isUsable(option);
            const selected = draft.formatId === option.id;
            return (
              <button
                key={option.id}
                disabled={!usable}
                onClick={() => {
                  update({ formatId: option.id });
                  setPhase('build');
                }}
                className={`rounded-xl border p-5 text-left transition ${
                  !usable
                    ? 'cursor-not-allowed border-border bg-surface-2/50 opacity-70'
                    : selected
                      ? 'border-accent/50 bg-surface ring-1 ring-accent/20'
                      : 'border-border bg-surface hover:border-border-hi'
                }`}
              >
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium tracking-tight">{option.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      option.support === 'supported'
                        ? 'bg-success/15 text-success'
                        : option.support === 'partial'
                          ? 'bg-warning/15 text-warning'
                          : 'bg-surface-2 text-faint'
                    }`}
                  >
                    {SUPPORT_LABEL[option.support]}
                  </span>
                  <span className="font-mono text-xs text-faint">{option.tagline}</span>
                </span>
                <span className="mt-2 block max-w-2xl text-sm leading-relaxed text-muted">{option.detail}</span>
                {option.limitation && (
                  <span className="mt-2 block max-w-2xl border-l-2 border-border pl-3 text-sm leading-relaxed text-faint">
                    {option.limitation}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- result step

  if (phase === 'result' && generated) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="order-2 lg:order-1">
          <GenerationResult
            draft={draft}
            generated={generated}
            onBack={() => setPhase('build')}
            onStartAnother={() => {
              saveDraft(null);
              setSavedDraft(null);
              setDraft(null);
              setGenerated(null);
              setPhase('market');
            }}
          />
        </div>
        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-20">
            <InvoicePreview draft={draft} totals={totals!} />
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------- build step
  //
  // The invoice is the interface. Rather than a form on one side and a preview
  // on the other — two views of the same data, inevitably drifting — the
  // fields sit in the document where their values will print. What cannot fit
  // there without turning an invoice into a tax form (VAT identifiers, contact
  // details, exemption reasons) hides behind a disclosure under the block it
  // belongs to, with a dot when the chosen ruleset needs it and it is missing.
  //
  // The rail on the right carries the actions and the compliance context, so
  // the document stays a document.

  const sellerCountry = getCountry(draft.seller.countryCode);
  const buyerCountry = getCountry(draft.buyer.countryCode);
  const crossBorder = isCrossBorder(draft.seller.countryCode, draft.buyer.countryCode);
  const relation = tradeRelation(draft.seller.countryCode, draft.buyer.countryCode);
  const availableCategories = categoriesFor(draft.seller.countryCode, draft.buyer.countryCode);
  const usedCategories = [...new Set(draft.lines.map((l) => l.vatCategory))];
  const reasonsNeeded = usedCategories.filter((c) => getVatCategory(c).exemptionReason === 'required');
  const bankLabels =
    sellerCountry.bank === 'uk'
      ? { account: 'Account number', provider: 'Sort code' }
      : sellerCountry.bank === 'us'
        ? { account: 'Account number', provider: 'Routing number (ABA)' }
        : { account: 'IBAN', provider: 'BIC / SWIFT' };
  const currency = draft.document.currency || 'EUR';
  const sellerLocale = sellerCountry.locale;
  const cash = (amount: Parameters<typeof formatMoney>[0]) => formatMoney(amount, currency, sellerLocale);

  // One rate for the whole invoice is how people think about tax. When the
  // lines disagree the field says so instead of flattening them silently.
  const standardRates = [
    ...new Set(
      draft.lines.filter((l) => getVatCategory(l.vatCategory).rate === 'positive').map((l) => l.vatRate),
    ),
  ];
  const taxIsMixed = standardRates.length > 1;

  function setLine(index: number, patch: Partial<InvoiceDraft['lines'][number]>) {
    update({ lines: draft!.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) });
  }

  /** Writing the document tax rate rewrites every standard-rated line. */
  function setTaxRate(rate: string) {
    update({
      tax: { rate },
      lines: draft!.lines.map((line) =>
        getVatCategory(line.vatCategory).rate === 'positive' ? { ...line, vatRate: rate } : line,
      ),
    });
  }

  function readLogo(file: File) {
    if (file.size > MAX_LOGO_BYTES) {
      setErrors([`That logo is ${(file.size / 1024).toFixed(0)} kB — keep it under ${MAX_LOGO_BYTES / 1024} kB.`]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update({ logo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  const partyIncomplete = (party: typeof draft.seller, seller: boolean) =>
    seller
      ? !party.vatId && !party.taxRegistrationId
      : usedCategories.some((c) => getVatCategory(c).buyerVatRequired) && !party.vatId;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
      {/* ------------------------------------------------------- the document */}
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-8 lg:p-10">
        {/* Masthead */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <div>
            {draft.logo ? (
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the user's own disk; next/image cannot optimise it and would not try */}
                <img src={draft.logo} alt="" className="max-h-24 max-w-[13rem] object-contain" />
                <button
                  onClick={() => update({ logo: undefined })}
                  className="rounded-lg px-2 py-1 text-xs text-muted transition hover:text-danger"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex h-24 w-52 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-bg text-sm text-muted transition hover:border-border-hi hover:text-text">
                + Add your logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) readLogo(file);
                  }}
                />
              </label>
            )}
            <p className="mt-1.5 max-w-[13rem] text-[11px] leading-relaxed text-faint">
              Printed only — EN 16931 has no logo field, so it is not written into the XML.
            </p>
          </div>

          <div className="text-right">
            <h2 className="mb-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {draft.document.typeCode === '381' ? 'CREDIT NOTE' : 'INVOICE'}
            </h2>
            <div className="flex items-center justify-end gap-2">
              <span className="text-sm text-faint">#</span>
              <DocField
                label="Invoice number"
                value={draft.document.number}
                onChange={(number) => update({ document: { ...draft.document, number } })}
                align="right"
                className="w-44"
              />
            </div>
          </div>
        </div>

        {/* From, and the dates */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-faint">From</div>
            <div className="grid gap-2">
              <DocField
                label="Your business name"
                placeholder="Who is this from?"
                value={draft.seller.name}
                onChange={(name) => update({ seller: { ...draft.seller, name } })}
                bold
              />
              <DocField
                label={`Your ${sellerCountry.address.streetLabel.toLowerCase()}`}
                placeholder={sellerCountry.address.streetLabel}
                value={draft.seller.street}
                onChange={(street) => update({ seller: { ...draft.seller, street } })}
              />
              <div className="grid grid-cols-2 gap-2">
                <DocField
                  label={`Your ${sellerCountry.address.cityLabel.toLowerCase()}`}
                  placeholder={sellerCountry.address.cityLabel}
                  value={draft.seller.city}
                  onChange={(city) => update({ seller: { ...draft.seller, city } })}
                />
                <DocField
                  label={`Your ${sellerCountry.address.postCodeLabel.toLowerCase()}`}
                  placeholder={sellerCountry.address.postCodeLabel}
                  value={draft.seller.postCode}
                  onChange={(postCode) => update({ seller: { ...draft.seller, postCode } })}
                />
              </div>
              <SelectField
                label="Your country"
                value={draft.seller.countryCode}
                onChange={(countryCode) =>
                  update({ seller: { ...draft.seller, countryCode, subdivision: '' } })
                }
                options={[
                  { value: '', label: 'Select a country…' },
                  ...COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name })),
                ]}
              />
            </div>
            <DocDetails summary="Tax and contact details" incomplete={partyIncomplete(draft.seller, true)}>
              <TextField
                label={sellerCountry.taxIdLabel}
                value={draft.seller.vatId}
                onChange={(vatId) => update({ seller: { ...draft.seller, vatId } })}
                placeholder={sellerCountry.taxIdPlaceholder}
                hint="BT-31"
              />
              <TextField
                label="Tax registration"
                value={draft.seller.taxRegistrationId}
                onChange={(taxRegistrationId) => update({ seller: { ...draft.seller, taxRegistrationId } })}
                hint="BT-32 — either this or the VAT identifier is required by every VAT category."
              />
              {sellerCountry.address.subdivisionLabel && (
                <TextField
                  label={sellerCountry.address.subdivisionLabel}
                  value={draft.seller.subdivision}
                  onChange={(subdivision) => update({ seller: { ...draft.seller, subdivision } })}
                />
              )}
              {sellerCountry.companyIdLabel && (
                <TextField
                  label={sellerCountry.companyIdLabel}
                  value={draft.seller.companyId}
                  onChange={(companyId) => update({ seller: { ...draft.seller, companyId } })}
                  hint="BT-30"
                />
              )}
              <TextField
                label="Contact name"
                value={draft.seller.contactName}
                onChange={(contactName) => update({ seller: { ...draft.seller, contactName } })}
                hint="BT-41"
              />
              <TextField
                label="Telephone"
                inputMode="tel"
                value={draft.seller.phone}
                onChange={(phone) => update({ seller: { ...draft.seller, phone } })}
                hint="BT-42"
              />
              <TextField
                label="Email"
                type="email"
                inputMode="email"
                value={draft.seller.email}
                onChange={(email) => update({ seller: { ...draft.seller, email } })}
                hint="BT-43"
              />
              <TextField
                label="Electronic address"
                value={draft.seller.electronicAddress}
                onChange={(electronicAddress) => update({ seller: { ...draft.seller, electronicAddress } })}
                hint="BT-34 — a Peppol participant id or email."
              />
            </DocDetails>
          </div>

          <div className="grid content-start gap-2">
            {[
              {
                label: 'Date',
                hint: 'BT-2',
                type: 'date',
                value: draft.document.issueDate,
                set: (issueDate: string) => update({ document: { ...draft.document, issueDate } }),
              },
              {
                label: 'Due date',
                hint: 'BT-9',
                type: 'date',
                value: draft.document.dueDate,
                set: (dueDate: string) => update({ document: { ...draft.document, dueDate } }),
              },
              {
                label: 'Delivery date',
                hint: 'BT-72',
                type: 'date',
                value: draft.document.deliveryDate,
                set: (deliveryDate: string) => update({ document: { ...draft.document, deliveryDate } }),
              },
              {
                label: 'PO number',
                hint: 'BT-13',
                type: 'text',
                value: draft.document.orderReference,
                set: (orderReference: string) => update({ document: { ...draft.document, orderReference } }),
              },
              {
                label: 'Your reference',
                hint: 'BT-10',
                type: 'text',
                value: draft.document.buyerReference,
                set: (buyerReference: string) => update({ document: { ...draft.document, buyerReference } }),
              },
            ].map((row) => (
              <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,11rem)] items-center gap-3">
                <span className="text-sm text-muted">
                  {row.label}
                  <span className="ml-1.5 font-mono text-[11px] text-faint">{row.hint}</span>
                </span>
                <DocField label={row.label} type={row.type} value={row.value} onChange={row.set} />
              </div>
            ))}
          </div>
        </div>

        {/* Bill to / ship to */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-faint">Bill to</div>
            <div className="grid gap-2">
              <DocField
                label="Customer name"
                placeholder="Who is this to?"
                value={draft.buyer.name}
                onChange={(name) => update({ buyer: { ...draft.buyer, name } })}
                bold
              />
              <DocField
                label={`Customer ${buyerCountry.address.streetLabel.toLowerCase()}`}
                placeholder={buyerCountry.address.streetLabel}
                value={draft.buyer.street}
                onChange={(street) => update({ buyer: { ...draft.buyer, street } })}
              />
              <div className="grid grid-cols-2 gap-2">
                <DocField
                  label={`Customer ${buyerCountry.address.cityLabel.toLowerCase()}`}
                  placeholder={buyerCountry.address.cityLabel}
                  value={draft.buyer.city}
                  onChange={(city) => update({ buyer: { ...draft.buyer, city } })}
                />
                <DocField
                  label={`Customer ${buyerCountry.address.postCodeLabel.toLowerCase()}`}
                  placeholder={buyerCountry.address.postCodeLabel}
                  value={draft.buyer.postCode}
                  onChange={(postCode) => update({ buyer: { ...draft.buyer, postCode } })}
                />
              </div>
              <SelectField
                label="Customer country"
                value={draft.buyer.countryCode}
                onChange={(countryCode) => update({ buyer: { ...draft.buyer, countryCode, subdivision: '' } })}
                options={[
                  { value: '', label: 'Select a country…' },
                  ...COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name })),
                ]}
              />
            </div>
            <DocDetails summary="Tax and contact details" incomplete={partyIncomplete(draft.buyer, false)}>
              <TextField
                label={buyerCountry.taxIdLabel}
                value={draft.buyer.vatId}
                onChange={(vatId) => update({ buyer: { ...draft.buyer, vatId } })}
                placeholder={buyerCountry.taxIdPlaceholder}
                hint="BT-48 — required for reverse charge and intra-community supplies."
              />
              {buyerCountry.address.subdivisionLabel && (
                <TextField
                  label={buyerCountry.address.subdivisionLabel}
                  value={draft.buyer.subdivision}
                  onChange={(subdivision) => update({ buyer: { ...draft.buyer, subdivision } })}
                />
              )}
              <TextField
                label="Contact name"
                value={draft.buyer.contactName}
                onChange={(contactName) => update({ buyer: { ...draft.buyer, contactName } })}
              />
              <TextField
                label="Email"
                type="email"
                inputMode="email"
                value={draft.buyer.email}
                onChange={(email) => update({ buyer: { ...draft.buyer, email } })}
              />
              <TextField
                label="Electronic address"
                value={draft.buyer.electronicAddress}
                onChange={(electronicAddress) => update({ buyer: { ...draft.buyer, electronicAddress } })}
                hint="BT-49"
              />
            </DocDetails>
            {crossBorder && (
              <p className="mt-3 rounded-lg border border-border bg-bg p-3 text-xs leading-relaxed text-muted">
                {sellerCountry.name} → {buyerCountry.name}.{' '}
                {relation === 'intra-eu'
                  ? 'Intra-EU: the intra-community and reverse-charge categories are on the line items.'
                  : relation === 'eu-export'
                    ? 'Export from the EU: the export category is on the line items.'
                    : 'Which tax treatment applies to this supply is your decision — Stampbench checks the document, not the transaction.'}
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-faint">
                Ship to
                <span className="ml-1.5 font-mono text-[11px] normal-case tracking-normal">BG-13</span>
              </span>
              <button
                onClick={() => update({ shipToEnabled: !draft.shipToEnabled })}
                className="rounded-lg px-2 py-1 text-xs font-medium text-accent-hi transition hover:bg-accent-dim/40"
              >
                {draft.shipToEnabled ? 'Remove' : '+ Add'}
              </button>
            </div>
            {draft.shipToEnabled ? (
              <div className="grid gap-2">
                <DocField
                  label="Delivery party name"
                  placeholder="Delivered to"
                  value={draft.shipTo.name}
                  onChange={(name) => update({ shipTo: { ...draft.shipTo, name } })}
                  bold
                />
                <DocField
                  label="Delivery street"
                  placeholder="Street"
                  value={draft.shipTo.street}
                  onChange={(street) => update({ shipTo: { ...draft.shipTo, street } })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <DocField
                    label="Delivery city"
                    placeholder="City"
                    value={draft.shipTo.city}
                    onChange={(city) => update({ shipTo: { ...draft.shipTo, city } })}
                  />
                  <DocField
                    label="Delivery post code"
                    placeholder="Post code"
                    value={draft.shipTo.postCode}
                    onChange={(postCode) => update({ shipTo: { ...draft.shipTo, postCode } })}
                  />
                </div>
                <SelectField
                  label="Delivery country"
                  value={draft.shipTo.countryCode}
                  onChange={(countryCode) => update({ shipTo: { ...draft.shipTo, countryCode } })}
                  options={[
                    { value: '', label: 'Select a country…' },
                    ...COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name })),
                  ]}
                />
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-faint">
                Optional. Add it when the goods or services went somewhere other than the billing address —
                it is written into the document as delivery information, not left on the printout.
              </p>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="mb-8">
          <div className="hidden rounded-t-lg bg-text px-4 py-2.5 text-xs font-medium uppercase tracking-[0.08em] text-white sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_7rem_8rem_7rem_2rem] sm:gap-3">
            <span>Item</span>
            <span className="text-right">Quantity</span>
            <span className="text-right">Rate</span>
            <span>Tax</span>
            <span className="text-right">Amount</span>
            <span className="sr-only">Actions</span>
          </div>
          <div className="flex flex-col gap-3 sm:gap-0">
            {draft.lines.map((line, index) => {
              const category = getVatCategory(line.vatCategory);
              const lineTotal = totals!.lines[index];
              return (
                <div
                  key={line.key}
                  className="rounded-xl border border-border p-3 sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_7rem_8rem_7rem_2rem] sm:items-center sm:gap-3 sm:rounded-none sm:border-x-0 sm:border-t-0 sm:px-4 sm:py-3"
                >
                  <div className="mb-2 sm:mb-0">
                    <DocField
                      label={`Line ${index + 1} description`}
                      placeholder="Description of item or service…"
                      value={line.description}
                      onChange={(description) => setLine(index, { description })}
                    />
                  </div>
                  <div className="mb-2 grid grid-cols-2 gap-2 sm:mb-0 sm:contents">
                    <DocField
                      label={`Line ${index + 1} quantity`}
                      value={line.quantity}
                      onChange={(quantity) => setLine(index, { quantity })}
                      align="right"
                      inputMode="decimal"
                    />
                    <DocField
                      label={`Line ${index + 1} unit price`}
                      value={line.unitPrice}
                      onChange={(unitPrice) => setLine(index, { unitPrice })}
                      align="right"
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="mb-2 sm:mb-0">
                    <SelectField
                      label={`Line ${index + 1} tax category`}
                      value={line.vatCategory}
                      onChange={(value) => {
                        const next = getVatCategory(value);
                        setLine(index, {
                          vatCategory: value as VatCategoryCode,
                          vatRate:
                            next.rate === 'positive' ? draft.tax.rate : next.rate === 'zero' ? '0' : '',
                        });
                      }}
                      options={availableCategories.map((c) => ({ value: c.code, label: `${c.code} · ${c.label}` }))}
                    />
                  </div>
                  <div className="flex items-center justify-between sm:justify-end">
                    <span className="text-xs text-faint sm:hidden">Amount</span>
                    <span className="text-sm font-medium tabular-nums">
                      {lineTotal ? cash(lineTotal.net) : ''}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-end sm:mt-0">
                    {draft.lines.length > 1 && (
                      <button
                        onClick={() => update({ lines: draft.lines.filter((_, i) => i !== index) })}
                        className="rounded-lg px-2 py-1.5 text-sm text-muted transition hover:bg-bg hover:text-danger"
                        aria-label={`Remove line ${index + 1}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() =>
              update({
                lines: [
                  ...draft.lines,
                  newLine(
                    draft.lines[draft.lines.length - 1]?.vatCategory ?? 'S',
                    draft.lines[draft.lines.length - 1]?.vatRate ?? draft.tax.rate,
                  ),
                ],
              })
            }
            className="w-full rounded-b-lg border border-border bg-bg py-2.5 text-sm font-medium text-accent-hi transition hover:bg-accent-dim/40"
          >
            + Line item
          </button>
        </div>

        {/* Notes, terms and the totals */}
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="grid content-start gap-4">
            <TextAreaField
              label="Notes"
              value={draft.document.note}
              onChange={(note) => update({ document: { ...draft.document, note } })}
              placeholder="Any relevant information not already covered"
              hint="BT-22"
            />
            <TextAreaField
              label="Terms"
              value={draft.document.paymentTerms}
              onChange={(paymentTerms) => update({ document: { ...draft.document, paymentTerms } })}
              placeholder="Late fees, payment methods, delivery schedule"
              hint="BT-20"
            />
            <DocDetails summary="Payment details">
              <SelectField
                label="Payment means"
                value={draft.payment.meansTypeCode}
                onChange={(meansTypeCode) => update({ payment: { ...draft.payment, meansTypeCode } })}
                options={PAYMENT_MEANS_OPTIONS.map((p) => ({ value: p.code, label: `${p.code} — ${p.label}` }))}
                hint="BT-81"
              />
              <TextField
                label="Account holder"
                value={draft.payment.accountName}
                onChange={(accountName) => update({ payment: { ...draft.payment, accountName } })}
                hint="BT-85"
              />
              <TextField
                label={bankLabels.account}
                value={draft.payment.accountId}
                onChange={(accountId) => update({ payment: { ...draft.payment, accountId } })}
                hint="BT-84"
              />
              <TextField
                label={bankLabels.provider}
                value={draft.payment.providerId}
                onChange={(providerId) => update({ payment: { ...draft.payment, providerId } })}
                hint="BT-86"
              />
            </DocDetails>
            {reasonsNeeded.length > 0 && (
              <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
                <h3 className="mb-1 text-sm font-medium">Exemption reasons</h3>
                <p className="mb-3 text-xs leading-relaxed text-muted">
                  The categories you used require a stated reason (BT-120). The placeholder is a starting
                  point — replace it with the wording that is correct for your supply.
                </p>
                <div className="grid gap-3">
                  {reasonsNeeded.map((code) => {
                    const category = getVatCategory(code);
                    return (
                      <TextField
                        key={code}
                        label={`${category.code} — ${category.label}`}
                        value={draft.exemptionReasons[code] ?? ''}
                        onChange={(value) =>
                          update({ exemptionReasons: { ...draft.exemptionReasons, [code]: value } })
                        }
                        placeholder={category.reasonSuggestion}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid content-start gap-1">
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="tabular-nums">{cash(totals!.net)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="text-muted">
                Tax
                {taxIsMixed && <span className="ml-2 text-xs text-warning">mixed rates</span>}
              </span>
              <span className="flex items-center gap-1">
                <input
                  aria-label="Tax rate for all standard-rated lines"
                  value={taxIsMixed ? '' : draft.tax.rate}
                  placeholder={taxIsMixed ? 'Mixed' : '0'}
                  inputMode="decimal"
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-20 rounded-lg border border-border bg-surface px-2 py-1.5 text-right text-sm outline-none transition focus:border-accent"
                />
                <span className="text-sm text-faint">%</span>
              </span>
            </div>
            <p className="mb-1 text-[11px] leading-relaxed text-faint">
              A rate, not a lump sum — BR-S-09 requires tax to equal taxable × rate.
              {sellerCountry.commonVatRates && (
                <> Common in {sellerCountry.name}: {sellerCountry.commonVatRates.join('%, ')}%.</>
              )}
            </p>
            {sellerCountry.code === 'US' && (
              <p className="mb-1 rounded-lg border border-border bg-bg p-2.5 text-[11px] leading-relaxed text-muted">
                {US_TAX_NOTE}
              </p>
            )}

            {draft.discount.enabled && (
              <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="text-muted">Discount</span>
                <span className="flex items-center gap-1">
                  <input
                    aria-label="Discount value"
                    value={draft.discount.value}
                    inputMode="decimal"
                    onChange={(e) => update({ discount: { ...draft.discount, value: e.target.value } })}
                    className="w-20 rounded-lg border border-border bg-surface px-2 py-1.5 text-right text-sm outline-none transition focus:border-accent"
                  />
                  <button
                    onClick={() =>
                      update({
                        discount: {
                          ...draft.discount,
                          mode: draft.discount.mode === 'percent' ? 'amount' : 'percent',
                        },
                      })
                    }
                    className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted transition hover:text-text"
                    aria-label={`Discount is ${draft.discount.mode === 'percent' ? 'a percentage' : 'a fixed amount'} — switch`}
                  >
                    {draft.discount.mode === 'percent' ? '%' : currency}
                  </button>
                  <button
                    onClick={() => update({ discount: { ...draft.discount, enabled: false } })}
                    className="rounded-lg px-1.5 py-1.5 text-xs text-muted transition hover:text-danger"
                    aria-label="Remove discount"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}

            {draft.shipping.enabled && (
              <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="text-muted">Shipping</span>
                <span className="flex items-center gap-1">
                  <input
                    aria-label="Shipping amount"
                    value={draft.shipping.value}
                    inputMode="decimal"
                    onChange={(e) => update({ shipping: { ...draft.shipping, value: e.target.value } })}
                    className="w-20 rounded-lg border border-border bg-surface px-2 py-1.5 text-right text-sm outline-none transition focus:border-accent"
                  />
                  <span className="px-2 py-1.5 text-xs text-faint">{currency}</span>
                  <button
                    onClick={() => update({ shipping: { ...draft.shipping, enabled: false } })}
                    className="rounded-lg px-1.5 py-1.5 text-xs text-muted transition hover:text-danger"
                    aria-label="Remove shipping"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}

            {(!draft.discount.enabled || !draft.shipping.enabled) && (
              <div className="flex flex-wrap gap-4 py-1 text-sm">
                {!draft.discount.enabled && (
                  <button
                    onClick={() => update({ discount: { ...draft.discount, enabled: true } })}
                    className="font-medium text-accent-hi hover:underline"
                  >
                    + Discount
                  </button>
                )}
                {!draft.shipping.enabled && (
                  <button
                    onClick={() => update({ shipping: { ...draft.shipping, enabled: true } })}
                    className="font-medium text-accent-hi hover:underline"
                  >
                    + Shipping
                  </button>
                )}
              </div>
            )}

            {totals!.categories.length > 0 && (
              <div className="border-t border-border pt-2">
                {totals!.categories.map((group) => {
                  const category = getVatCategory(group.categoryCode);
                  return (
                    <div
                      key={`${group.categoryCode}-${group.rate}`}
                      className="flex justify-between py-0.5 text-xs text-faint"
                    >
                      <span>
                        {category.code === 'S' ? `VAT ${group.rate ?? 0}%` : `${category.code} · ${category.label}`}
                        {' on '}
                        {cash(group.taxable)}
                      </span>
                      <span className="tabular-nums">{cash(group.tax)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-2 flex justify-between border-t border-border pt-3 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{cash(totals!.gross)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="text-muted">
                Amount paid<span className="ml-1.5 font-mono text-[11px] text-faint">BT-113</span>
              </span>
              <span className="flex items-center gap-1">
                <input
                  aria-label="Amount already paid"
                  value={draft.amountPaid}
                  inputMode="decimal"
                  placeholder="0"
                  onChange={(e) => update({ amountPaid: e.target.value })}
                  className="w-24 rounded-lg border border-border bg-surface px-2 py-1.5 text-right text-sm outline-none transition focus:border-accent"
                />
                <span className="px-1 text-xs text-faint">{currency}</span>
              </span>
            </div>

            <div className="mt-1 flex justify-between border-t border-border pt-3 text-lg font-semibold">
              <span>Balance due</span>
              <span className="tabular-nums">{cash(totals!.balance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- the rail */}
      {/* Below the two-column breakpoint the rail stacks, and stacking it
          *under* a full invoice buries the one button the page exists for.
          So it leads on narrow screens and returns to the right on wide ones. */}
      <aside className="order-first flex flex-col gap-4 lg:order-none lg:sticky lg:top-20">
        {errors.length > 0 && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm">
            <p className="mb-1 font-medium text-danger">Before creating:</p>
            <ul className="list-disc pl-4 text-muted">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={generate} className={`${BUTTON_PRIMARY} w-full`}>
          Create invoice
        </button>

        <AiAssist
          currency={currency}
          onApply={(aiLines, note) =>
            update({
              lines: aiLines.map((line) =>
                ({
                  ...newLine(draft.lines[0]?.vatCategory ?? 'S', draft.tax.rate),
                  description: line.description,
                  quantity: String(line.quantity),
                  unitCode: line.unitCode,
                  unitPrice: line.unitPrice ? String(line.unitPrice) : '',
                }),
              ),
              document: note ? { ...draft.document, note } : draft.document,
            })
          }
        />

        <div className="rounded-xl border border-border bg-surface p-4">
          <details>
            <summary className="cursor-pointer list-none text-sm font-medium">
              Invoice settings
              <span className="ml-1.5 text-xs font-normal text-faint">market, format, currency</span>
            </summary>
            <div className="mt-3 grid gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Flag code={MARKETS[draft.market].flag} size={20} />
                <span className="font-medium">{MARKETS[draft.market].name}</span>
              </div>
              <p className="font-mono text-[11px] text-faint">{rulesetLabelFor(format!)}</p>
              <SelectField
                label="Currency"
                value={draft.document.currency}
                onChange={(c) => update({ document: { ...draft.document, currency: c } })}
                options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))}
              />
              <SelectField
                label="Document type"
                value={draft.document.typeCode}
                onChange={(typeCode) => update({ document: { ...draft.document, typeCode } })}
                options={TYPE_CODE_OPTIONS.map((t) => ({ value: t.code, label: `${t.code} — ${t.label}` }))}
              />
              <div className="flex flex-wrap gap-3 text-sm">
                <button onClick={() => setPhase('format')} className={BUTTON_QUIET}>
                  Change format
                </button>
                <button onClick={() => setPendingMarket(draft.market)} className={BUTTON_QUIET}>
                  Change market
                </button>
              </div>
            </div>
          </details>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-medium">Compliance context</h2>
          {checks.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted">
              This format has no ruleset, so there is nothing to check.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {checks.map((check) => (
                <li key={`${check.rule}-${check.label}`} className="flex items-start gap-2 text-xs">
                  <span aria-hidden className={`mt-0.5 font-mono ${check.met ? 'text-success' : 'text-warning'}`}>
                    {check.met ? '✓' : '○'}
                  </span>
                  <span>
                    <span className={check.met ? 'text-muted' : 'text-text'}>{check.label}</span>
                    <span className="ml-1 font-mono text-[10px] text-faint">{check.rule}</span>
                    <span className="sr-only">{check.met ? ' — provided' : ' — still needed'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-faint">
            Each item names the rule that enforces it. Validation decides — this is a preview of it.
          </p>
        </div>

        <p className="text-[11px] leading-relaxed text-faint">
          Runs entirely in your browser. The invoice is not uploaded, and the draft is kept only in this
          browser&apos;s local storage.{' '}
          <Link href="/privacy" className="text-accent-hi hover:underline">
            Privacy
          </Link>
        </p>
      </aside>

      {/* Changing market is destructive enough to ask. */}
      {pendingMarket !== null && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-5 lg:col-span-2">
          <h2 className="mb-1 font-medium tracking-tight">Change the market?</h2>
          <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted">
            A different market means a different ruleset, different required fields and a different format.
            Your data is kept — fields the new market does not use simply stop being asked for, and the
            format resets to that market&apos;s default.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {PAGE_MARKETS.map((id) => (
              <button
                key={id}
                onClick={() => setPendingMarket(id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  pendingMarket === id ? 'border-accent/50 bg-accent-dim/40 text-accent-hi' : 'border-border'
                }`}
              >
                <Flag code={MARKETS[id].flag} size={18} />
                {MARKETS[id].name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const next = pendingMarket;
                const fresh = emptyDraft(next, new Date());
                writeMarket(next);
                update({ market: next, formatId: fresh.formatId });
                setPendingMarket(null);
              }}
              className={BUTTON_PRIMARY}
            >
              Keep my data and switch
            </button>
            <button onClick={() => setPendingMarket(null)} className={BUTTON_SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
