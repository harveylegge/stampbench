'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@stampbench/core';

import { Flag } from '@/components/flag';
import {
  BUTTON_PRIMARY,
  BUTTON_QUIET,
  BUTTON_SECONDARY,
  Section,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/invoice/fields';
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
  newLine,
  PAYMENT_MEANS_OPTIONS,
  TYPE_CODE_OPTIONS,
  UNIT_OPTIONS,
  type DraftParty,
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

function loadDraft(): InvoiceDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InvoiceDraft;
    return parsed && Array.isArray(parsed.lines) ? parsed : null;
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

// ------------------------------------------------------------------ party form

function PartyForm({
  party,
  onChange,
  role,
}: {
  party: DraftParty;
  onChange: (patch: Partial<DraftParty>) => void;
  role: 'seller' | 'buyer';
}) {
  const country = getCountry(party.countryCode);
  const isSeller = role === 'seller';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label="Legal name"
        value={party.name}
        onChange={(name) => onChange({ name })}
        required
        className="sm:col-span-2"
        hint={isSeller ? 'BT-27 — the registered name, as it appears on the company register.' : 'BT-44'}
      />
      <TextField
        label="Trading name (optional)"
        value={party.tradingName}
        onChange={(tradingName) => onChange({ tradingName })}
      />
      <SelectField
        label="Country"
        value={party.countryCode}
        onChange={(countryCode) => onChange({ countryCode, subdivision: '' })}
        options={[
          { value: '', label: 'Select a country…' },
          ...COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name })),
        ]}
        required
      />
      <TextField
        label={country.address.streetLabel}
        value={party.street}
        onChange={(street) => onChange({ street })}
        className="sm:col-span-2"
        autoComplete="off"
      />
      <TextField label={country.address.cityLabel} value={party.city} onChange={(city) => onChange({ city })} />
      <TextField
        label={country.address.postCodeLabel}
        value={party.postCode}
        onChange={(postCode) => onChange({ postCode })}
        placeholder={country.address.postCodePlaceholder}
      />
      {country.address.subdivisionLabel &&
        (country.address.subdivisions ? (
          <SelectField
            label={country.address.subdivisionLabel}
            value={party.subdivision}
            onChange={(subdivision) => onChange({ subdivision })}
            required={country.address.subdivisionRequired}
            options={[
              { value: '', label: 'Select…' },
              ...country.address.subdivisions.map((s) => ({ value: s.code, label: s.name })),
            ]}
          />
        ) : (
          <TextField
            label={country.address.subdivisionLabel}
            value={party.subdivision}
            onChange={(subdivision) => onChange({ subdivision })}
          />
        ))}
      <TextField
        label={country.taxIdLabel}
        value={party.vatId}
        onChange={(vatId) => onChange({ vatId })}
        placeholder={country.taxIdPlaceholder}
        hint={isSeller ? 'BT-31' : 'BT-48 — needed for reverse charge and intra-community supplies.'}
      />
      {isSeller && (
        <TextField
          label="Tax registration (optional)"
          value={party.taxRegistrationId}
          onChange={(taxRegistrationId) => onChange({ taxRegistrationId })}
          hint="BT-32 — a Steuernummer, UTR or EIN. Either this or the VAT identifier is required."
        />
      )}
      {country.companyIdLabel && (
        <TextField
          label={`${country.companyIdLabel} (optional)`}
          value={party.companyId}
          onChange={(companyId) => onChange({ companyId })}
        />
      )}
      <TextField
        label="Contact name"
        value={party.contactName}
        onChange={(contactName) => onChange({ contactName })}
      />
      <TextField
        label="Email"
        type="email"
        inputMode="email"
        value={party.email}
        onChange={(email) => onChange({ email })}
      />
      <TextField label="Telephone" inputMode="tel" value={party.phone} onChange={(phone) => onChange({ phone })} />
      <TextField
        label="Electronic address (optional)"
        value={party.electronicAddress}
        onChange={(electronicAddress) => onChange({ electronicAddress })}
        hint={isSeller ? 'BT-34' : 'BT-49 — a Peppol participant id or email, used for electronic delivery.'}
      />
    </div>
  );
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

  const sellerCountry = getCountry(draft.seller.countryCode);
  const buyerCountry = getCountry(draft.buyer.countryCode);
  const crossBorder = isCrossBorder(draft.seller.countryCode, draft.buyer.countryCode);
  const relation = tradeRelation(draft.seller.countryCode, draft.buyer.countryCode);
  const availableCategories = categoriesFor(draft.seller.countryCode, draft.buyer.countryCode);
  const usedCategories = [...new Set(draft.lines.map((l) => l.vatCategory))];
  const bankLabels =
    sellerCountry.bank === 'uk'
      ? { account: 'Account number', provider: 'Sort code', accountHint: 'BT-84', providerHint: 'BT-86' }
      : sellerCountry.bank === 'us'
        ? { account: 'Account number', provider: 'Routing number (ABA)', accountHint: 'BT-84', providerHint: 'BT-86' }
        : { account: 'IBAN', provider: 'BIC / SWIFT', accountHint: 'BT-84', providerHint: 'BT-86' };
  const currency = draft.document.currency || 'EUR';
  const sellerLocale = sellerCountry.locale;

  function setLine(index: number, patch: Partial<InvoiceDraft['lines'][number]>) {
    update({ lines: draft!.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Context bar: what is being built, and how to change it. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Flag code={MARKETS[draft.market].flag} size={20} />
            {MARKETS[draft.market].name}
          </span>
          <span className="text-faint">·</span>
          <span className="text-muted">{format!.name}</span>
          <span className="font-mono text-xs text-faint">{rulesetLabelFor(format!)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPhase('format')} className={BUTTON_QUIET}>
            Change format
          </button>
          <button onClick={() => setPendingMarket(draft.market)} className={BUTTON_QUIET}>
            Change market
          </button>
        </div>
      </div>

      {/* Changing market is destructive enough to ask. */}
      {pendingMarket !== null && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-5">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* ------------------------------------------------------ editor */}
        <div className="flex flex-col gap-5">
          <Section
            title="Seller"
            description={`Your business. ${sellerCountry.code ? `Fields follow ${sellerCountry.name}.` : ''}`}
          >
            <PartyForm
              party={draft.seller}
              role="seller"
              onChange={(patch) => update({ seller: { ...draft.seller, ...patch } })}
            />
          </Section>

          <Section
            title="Buyer"
            description="Who the invoice is addressed to."
            aside={
              crossBorder ? (
                <span className="rounded-full bg-accent-dim px-2.5 py-1 text-xs font-medium text-accent-hi">
                  Cross-border
                </span>
              ) : undefined
            }
          >
            <PartyForm
              party={draft.buyer}
              role="buyer"
              onChange={(patch) => update({ buyer: { ...draft.buyer, ...patch } })}
            />
            {crossBorder && (
              <p className="mt-4 rounded-lg border border-border bg-bg p-3 text-sm leading-relaxed text-muted">
                {sellerCountry.name} → {buyerCountry.name}.{' '}
                {relation === 'intra-eu'
                  ? 'Intra-EU: the intra-community and reverse-charge categories are available below.'
                  : relation === 'eu-export'
                    ? 'Export from the EU: the export category is available below.'
                    : 'Stampbench checks the document against the selected ruleset. Which tax treatment applies to this supply is a question for you or your accountant — it is not determined here.'}
              </p>
            )}
          </Section>

          <Section title="Invoice details" description="Dates, references and the document type.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Invoice number"
                value={draft.document.number}
                onChange={(number) => update({ document: { ...draft.document, number } })}
                required
                hint="BT-1"
              />
              <SelectField
                label="Document type"
                value={draft.document.typeCode}
                onChange={(typeCode) => update({ document: { ...draft.document, typeCode } })}
                options={TYPE_CODE_OPTIONS.map((t) => ({ value: t.code, label: `${t.code} — ${t.label}` }))}
                hint="BT-3"
              />
              <TextField
                label="Issue date"
                type="date"
                value={draft.document.issueDate}
                onChange={(issueDate) => update({ document: { ...draft.document, issueDate } })}
                required
                hint="BT-2"
              />
              <TextField
                label="Due date"
                type="date"
                value={draft.document.dueDate}
                onChange={(dueDate) => update({ document: { ...draft.document, dueDate } })}
                hint="BT-9"
              />
              <SelectField
                label="Currency"
                value={draft.document.currency}
                onChange={(c) => update({ document: { ...draft.document, currency: c } })}
                options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))}
                hint="BT-5"
              />
              <TextField
                label="Delivery date (optional)"
                type="date"
                value={draft.document.deliveryDate}
                onChange={(deliveryDate) => update({ document: { ...draft.document, deliveryDate } })}
                hint="Appears on the printable document only. The semantic model does not carry delivery information (BT-72 / BG-13) yet, so it is not written into the XML."
              />
              <TextField
                label="Buyer reference"
                value={draft.document.buyerReference}
                onChange={(buyerReference) => update({ document: { ...draft.document, buyerReference } })}
                hint={
                  format!.validationProfile === 'xrechnung'
                    ? 'BT-10 — required by BR-DE-15. The Leitweg-ID for German public buyers; otherwise the buyer’s own reference. Ask them; never invent it.'
                    : 'BT-10 — the reference your buyer asked you to quote.'
                }
              />
              <TextField
                label="Order reference (optional)"
                value={draft.document.orderReference}
                onChange={(orderReference) => update({ document: { ...draft.document, orderReference } })}
                hint="BT-13"
              />
              <TextField
                label="Contract reference (optional)"
                value={draft.document.contractReference}
                onChange={(contractReference) =>
                  update({ document: { ...draft.document, contractReference } })
                }
                hint="BT-12"
                className="sm:col-span-2"
              />
              <TextAreaField
                label="Payment terms"
                value={draft.document.paymentTerms}
                onChange={(paymentTerms) => update({ document: { ...draft.document, paymentTerms } })}
                hint="BT-20"
                className="sm:col-span-2"
              />
            </div>
          </Section>

          <Section
            title="Line items"
            description="Totals are computed from these — exactly, in minor units, never in floating point."
            aside={
              <button
                onClick={() =>
                  update({
                    lines: [
                      ...draft.lines,
                      newLine(
                        draft.lines[draft.lines.length - 1]?.vatCategory ?? 'S',
                        draft.lines[draft.lines.length - 1]?.vatRate ?? '',
                      ),
                    ],
                  })
                }
                className={BUTTON_SECONDARY}
              >
                Add line
              </button>
            }
          >
            <div className="flex flex-col gap-4">
              {draft.lines.map((line, index) => {
                const category = getVatCategory(line.vatCategory);
                const rateDisabled = category.rate !== 'positive';
                const lineTotal = totals!.lines[index];
                return (
                  <div key={line.key} className="rounded-xl border border-border bg-bg p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-faint">
                        Line {index + 1}
                      </span>
                      {draft.lines.length > 1 && (
                        <button
                          onClick={() => update({ lines: draft.lines.filter((_, i) => i !== index) })}
                          // -my-1.5 keeps the row height unchanged while the
                          // padding gives the control a thumb-sized hit area.
                          className="-my-1.5 rounded-lg px-2 py-1.5 text-sm text-muted transition hover:bg-surface hover:text-danger"
                          aria-label={`Remove line ${index + 1}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-6">
                      <TextField
                        label="Description"
                        value={line.description}
                        onChange={(description) => setLine(index, { description })}
                        className="sm:col-span-4"
                      />
                      <TextField
                        label="Item code"
                        value={line.sku}
                        onChange={(sku) => setLine(index, { sku })}
                        className="sm:col-span-2"
                      />
                      <TextField
                        label="Quantity"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(quantity) => setLine(index, { quantity })}
                        className="sm:col-span-1"
                      />
                      <SelectField
                        label="Unit"
                        value={line.unitCode}
                        onChange={(unitCode) => setLine(index, { unitCode })}
                        options={UNIT_OPTIONS.map((u) => ({ value: u.code, label: u.label }))}
                        className="sm:col-span-1"
                      />
                      <TextField
                        label={`Unit price (${currency})`}
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(unitPrice) => setLine(index, { unitPrice })}
                        className="sm:col-span-2"
                      />
                      <SelectField
                        label="Tax category"
                        value={line.vatCategory}
                        onChange={(value) => {
                          const next = getVatCategory(value);
                          setLine(index, {
                            vatCategory: value as VatCategoryCode,
                            vatRate: next.rate === 'positive' ? line.vatRate : next.rate === 'zero' ? '0' : '',
                          });
                        }}
                        options={availableCategories.map((c) => ({ value: c.code, label: `${c.code} — ${c.label}` }))}
                        className="sm:col-span-1"
                      />
                      <TextField
                        label="Rate %"
                        inputMode="decimal"
                        value={rateDisabled ? (category.rate === 'zero' ? '0' : '—') : line.vatRate}
                        onChange={(vatRate) => setLine(index, { vatRate })}
                        className="sm:col-span-1"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                      <span className="text-faint">{category.description}</span>
                      <span className="font-medium tabular-nums">
                        {lineTotal ? formatMoney(lineTotal.net, currency, sellerLocale) : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {sellerCountry.commonVatRates && (
              <p className="mt-4 text-xs leading-relaxed text-faint">
                Rates commonly used in {sellerCountry.name}: {sellerCountry.commonVatRates.join('%, ')}%.
                These are suggestions, not advice — the rate that applies to your supply is your decision.
              </p>
            )}
            {sellerCountry.code === 'US' && (
              <p className="mt-3 rounded-lg border border-border bg-bg p-3 text-sm leading-relaxed text-muted">
                {US_TAX_NOTE}
              </p>
            )}
          </Section>

          {usedCategories.some((code) => getVatCategory(code).exemptionReason === 'required') && (
            <Section
              title="Exemption reasons"
              description="The categories you have used require a stated reason (BT-120). Stampbench will not write one for you."
            >
              <div className="grid gap-4">
                {usedCategories
                  .filter((code) => getVatCategory(code).exemptionReason === 'required')
                  .map((code) => {
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
                        hint="A suggestion appears as placeholder text. Replace it with the wording that is correct for your supply."
                      />
                    );
                  })}
              </div>
            </Section>
          )}

          <Section title="Payment" description={`Bank details in the form ${sellerCountry.name} uses.`}>
            <div className="grid gap-4 sm:grid-cols-2">
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
                hint={bankLabels.accountHint}
              />
              <TextField
                label={bankLabels.provider}
                value={draft.payment.providerId}
                onChange={(providerId) => update({ payment: { ...draft.payment, providerId } })}
                hint={bankLabels.providerHint}
              />
              <TextField
                label="Payment reference (optional)"
                value={draft.payment.remittance}
                onChange={(remittance) => update({ payment: { ...draft.payment, remittance } })}
                hint="BT-83"
                className="sm:col-span-2"
              />
            </div>
          </Section>

          <Section title="Notes" description="Anything else that should appear on the document.">
            <TextAreaField
              label="Invoice note (optional)"
              value={draft.document.note}
              onChange={(note) => update({ document: { ...draft.document, note } })}
              hint="BT-22"
            />
          </Section>
        </div>

        {/* ------------------------------------------------- summary rail */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.12em] text-faint">Totals</h2>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="tabular-nums">{formatMoney(totals!.net, currency, sellerLocale)}</span>
            </div>
            {totals!.categories.map((group) => {
              const category = getVatCategory(group.categoryCode);
              return (
                <div key={`${group.categoryCode}-${group.rate}`} className="flex justify-between py-1 text-sm">
                  <span className="text-muted">
                    {category.code === 'S' ? `VAT ${group.rate ?? 0}%` : `${category.label}`}
                  </span>
                  <span className="tabular-nums text-muted">{formatMoney(group.tax, currency, sellerLocale)}</span>
                </div>
              );
            })}
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(totals!.gross, currency, sellerLocale)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-1 text-sm font-medium uppercase tracking-[0.12em] text-faint">
              Compliance context
            </h2>
            <p className="mb-3 font-mono text-xs text-muted">{rulesetLabelFor(format!)}</p>
            {checks.length === 0 ? (
              <p className="text-sm text-muted">This format has no ruleset, so there is nothing to check.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {checks.map((check) => (
                  <li key={`${check.rule}-${check.label}`} className="flex items-start gap-2 text-sm">
                    <span
                      aria-hidden
                      className={`mt-0.5 font-mono ${check.met ? 'text-success' : 'text-warning'}`}
                    >
                      {check.met ? '✓' : '○'}
                    </span>
                    <span>
                      <span className={check.met ? 'text-muted' : 'text-text'}>{check.label}</span>
                      <span className="ml-1.5 font-mono text-[11px] text-faint">{check.rule}</span>
                      <span className="sr-only">{check.met ? ' — provided' : ' — still needed'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-faint">
              Every item names the rule that enforces it. Validation is what decides — this is a preview of
              it, not a second opinion.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            {errors.length > 0 && (
              <div role="alert" className="mb-3 rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm">
                <p className="mb-1 font-medium text-danger">Before generating:</p>
                <ul className="list-disc pl-4 text-muted">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            <button onClick={generate} className={`${BUTTON_PRIMARY} w-full`}>
              Generate and validate
            </button>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              Runs in your browser. The invoice is not uploaded, and the draft is stored only in this
              browser&apos;s local storage.{' '}
              <Link href="/privacy" className="text-accent-hi hover:underline">
                Privacy
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* The preview lives below the editor on every width — on desktop the
          rail carries the numbers, and duplicating the document there would
          shrink both to uselessness. */}
      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Preview</h2>
        <InvoicePreview draft={draft} totals={totals!} />
      </div>
    </div>
  );
}
