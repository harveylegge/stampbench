# @stampbench/medusa

**E-invoicing for Medusa.** Generate and validate XRechnung / EN 16931 e-invoices
straight from your Medusa orders — an admin widget, an API, and a workflow, powered by
[Stampbench](https://stampbench.com).

Created by [Harvey Legge](https://github.com/harveylegge), founder of Stampbench.

Germany requires every business to be able to *receive* e-invoices since January 2025 and
to *issue* them from January 2027 (2028 for the smallest businesses); France and other EU
states follow with their own mandates. If your Medusa store sells B2B in the EU, PDFs stop
being invoices. This plugin makes every order exportable as a compliant XRechnung 3.0 (UBL)
document — validated against the EN 16931 business rules (BR, BR-CO, VAT categories) and the
German BR-DE CIUS *before* it reaches your buyer, with plain-language rule violations when
something is missing.

## What you get

- **Admin widget** on the order detail page: one-click *Download XML* plus a live
  compliance badge (rule violations counted before you send anything).
- **`GET /admin/orders/:id/e-invoice`** — the invoice as UBL XML (download), or
  `?format=json` for `{ xml, invoice, validation }`.
- **`POST /admin/e-invoices/validate`** — validate any UBL/CII document you receive.
- **`generateEInvoiceWorkflow`** — compose e-invoicing into your own flows
  (email the XML on `order.placed`, attach it to fulfilments, …).
- **`stampbench` module** — the service itself, resolvable from any subscriber, job,
  or custom endpoint.

Validation never blocks generation: you always get the document *and* the verdict.
An incomplete seller configuration shows up as named rule violations (e.g. `BR-DE-2`),
not as a stack trace.

## Installation

```bash
npm install @stampbench/medusa
# or: npx medusa plugin:add @stampbench/medusa
```

Requires Medusa ≥ 2.5 and Node ≥ 20.19 (the first LTS line able to `require()` ES modules).

Register the plugin in `medusa-config.ts`. The seller block is your legal identity on every
invoice — XRechnung requires the full set below:

```ts
module.exports = defineConfig({
  plugins: [
    {
      resolve: "@stampbench/medusa",
      options: {
        seller: {
          name: "Bergmann Audio GmbH",
          vatId: "DE123456789",                    // and/or taxRegistrationId
          electronicAddress: "billing@bergmann-audio.de",
          electronicAddressScheme: "EM",           // "EM" = email, "0204" = Leitweg-ID
          address: {
            streetName: "Torstraße 12",
            city: "Berlin",
            postCode: "10119",
            countryCode: "DE",
          },
          contact: {
            name: "Jonas Bergmann",
            phone: "+49 30 1234567",
            email: "billing@bergmann-audio.de",
          },
        },
        payment: {
          meansTypeCode: "58",                     // SEPA credit transfer
          creditTransfers: [
            { iban: "DE89370400440532013000", accountName: "Bergmann Audio GmbH" },
          ],
        },
      },
    },
  ],
})
```

That's the whole setup. Open any order in the admin and the **E-Invoice** card appears in
the sidebar.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `seller` | — | BG-4, you. Name, address, VAT id, electronic address, contact (all required by BR-DE). |
| `payment` | — | BG-16 payment instructions. `meansTypeCode: "58"` + IBAN for SEPA. Required by BR-DE-1. |
| `profile` | `"xrechnung"` | Ruleset the documents declare and validate against: `"xrechnung"` or `"en16931"`. |
| `invoiceNumberPrefix` | `"INV-"` | Invoice number is `<prefix><order display id>`. |
| `paymentTermsDays` | `14` | Due date relative to the issue date. |
| `paymentTerms` | — | BT-20 terms text (Skonto lines for XRechnung go here). |
| `defaultUnitCode` | `"C62"` | UN/ECE Rec 20 unit for order lines. |
| `zeroVatCategoryCode` | `"Z"` | VAT category for 0%-taxed lines: `"Z"`, `"E"`, `"G"`, `"AE"`, `"O"`. |
| `vatExemptionReason` | — | BT-120 reason text, required with the exempt categories above. |
| `defaultBuyerReference` | — | BT-10 fallback (XRechnung requires a buyer reference; the order number is the last resort). |
| `notes` | — | BT-22 notes stamped on every invoice (e.g. `"Kleinunternehmer §19 UStG"`). |

Per-invoice overrides (`invoiceNumber`, `issueDate`, `dueDate`, `buyerReference`,
`typeCode`, `notes`) are accepted by the workflow, the service, and as query parameters on
the download endpoint.

## How orders map

| Medusa | Invoice |
| --- | --- |
| `display_id` | Invoice number (prefixed) and purchase-order reference (BT-13) |
| `items[]` (title, sku, quantity, `total − tax_total`) | Invoice lines (BG-25) with net amounts — promotions stay folded into the line |
| `items[].tax_lines[].rate` | Line VAT (BG-30): `S` above 0%, `zeroVatCategoryCode` at 0% |
| `shipping_methods[]` | Document-level charges (BG-21) with their own VAT |
| `billing_address` + `customer` | Buyer (BG-7), company name preferred |
| `shipping_address` | Delivery (BG-13) |
| `email` | Buyer electronic address (BT-49, scheme `EM`) |
| `metadata.vat_id` (order or customer) | Buyer VAT id (BT-48) |
| `metadata.buyer_reference` / `metadata.leitweg_id` | Buyer reference (BT-10) — set the Leitweg-ID here for German B2G |

Totals (BT-106…BT-115) and the VAT breakdown (BG-23) are computed from the mapped lines,
so the EN 16931 arithmetic chain (BR-CO) passes by construction.

## Using the workflow

```ts
import { generateEInvoiceWorkflow } from "@stampbench/medusa/workflows"

// e.g. in a subscriber for order.placed
export default async function handler({ event, container }: SubscriberArgs<{ id: string }>) {
  const { result } = await generateEInvoiceWorkflow(container).run({
    input: { order_id: event.data.id },
  })
  // result.xml, result.invoice, result.validation
}
```

Or resolve the service directly:

```ts
import { STAMPBENCH_MODULE } from "@stampbench/medusa/modules/stampbench"

const stampbench = container.resolve(STAMPBENCH_MODULE)
const { xml, validation } = stampbench.generate(order)
```

## Scope & honesty

The rule engine covers UBL syntax, the EN 16931 core rules including the VAT category
families, and the XRechnung (BR-DE) CIUS — the documented subset in
[`@stampbench/core`](https://www.npmjs.com/package/@stampbench/core). It is developer
tooling, not legal advice; for certification-grade assurance also run the official KoSIT
validator in CI (Stampbench maintains a parity harness against it).

## Local development

```bash
npm install
npm run typecheck && npm test     # unit tests for the order → invoice mapping
npm run dev                        # medusa plugin:develop, for use with a local Medusa app
npm run build                      # medusa plugin:build → .medusa/server
```

In the Stampbench monorepo, until `@stampbench/core@0.1.2` is on npm, point the dependency
at the workspace copy before installing (and revert before committing):

```bash
npm pkg set 'dependencies.@stampbench/core=file:../../packages/core'
```

## License

MIT © [Harvey Legge](https://stampbench.com)
