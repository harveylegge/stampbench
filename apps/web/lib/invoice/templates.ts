/**
 * Starting points, with realistic — and entirely fictional — example data.
 *
 * Every company, VAT number, IBAN and address below is invented. None of them
 * belongs to a real business, and nothing here should be mistaken for a real
 * trading relationship: an invoice template that ships a real company's name
 * as "your customer" is the kind of thing that ends up in someone's accounts
 * payable by accident.
 *
 * The IBANs use the documentation-style patterns that pass a checksum but
 * belong to no account. The VAT numbers are structurally shaped but not issued.
 */
import type { MarketId } from '@/lib/markets';
import { emptyDraft, newLine, type InvoiceDraft } from './draft';

export interface InvoiceTemplate {
  id: string;
  name: string;
  market: MarketId;
  formatId: string;
  /** What this template demonstrates — shown under the name. */
  description: string;
  /** Applied on top of a fresh draft for the template's market. */
  apply: (base: InvoiceDraft) => InvoiceDraft;
}

function line(
  description: string,
  quantity: string,
  unitCode: string,
  unitPrice: string,
  vatRate: string,
  vatCategory: InvoiceDraft['lines'][number]['vatCategory'] = 'S',
  sku = '',
) {
  return { ...newLine(vatCategory, vatRate), description, quantity, unitCode, unitPrice, sku };
}

export const TEMPLATES: InvoiceTemplate[] = [
  {
    id: 'uk-consulting',
    name: 'UK consulting invoice',
    market: 'uk',
    formatId: 'en16931-ubl',
    description: 'A London consultancy billing a UK client at the standard rate, paid by bank transfer.',
    apply: (base) => ({
      ...base,
      seller: {
        ...base.seller,
        name: 'Thornbury Analytics Ltd',
        vatId: 'GB428915370',
        companyId: '09823145',
        street: '4 Ravenscroft Yard',
        city: 'London',
        postCode: 'EC1V 9BW',
        countryCode: 'GB',
        contactName: 'Accounts',
        email: 'billing@thornburyanalytics.example',
        phone: '+44 20 7946 0812',
      },
      buyer: {
        ...base.buyer,
        name: 'Halden Retail Group plc',
        vatId: 'GB672104558',
        street: '18 Calder Street',
        city: 'Manchester',
        postCode: 'M3 4AN',
        countryCode: 'GB',
        contactName: 'Priya Raman',
        email: 'ap@haldenretail.example',
      },
      document: {
        ...base.document,
        currency: 'GBP',
        buyerReference: 'PO-2026-8841',
        orderReference: 'PO-2026-8841',
        paymentTerms: 'Payment within 30 days. Late payment interest applies under the Late Payment of Commercial Debts (Interest) Act 1998.',
      },
      lines: [
        line('Data platform review — senior consultant', '7.5', 'HUR', '145.00', '20', 'S', 'CONS-SR'),
        line('Workshop facilitation', '2', 'DAY', '950.00', '20', 'S', 'CONS-WS'),
        line('Travel and subsistence (recharged at cost)', '1', 'C62', '318.40', '20', 'S'),
      ],
      payment: {
        ...base.payment,
        meansTypeCode: '30',
        accountName: 'Thornbury Analytics Ltd',
        accountId: '41827396',
        providerId: '20-45-11',
        remittance: 'INV reference on payment',
      },
    }),
  },

  {
    id: 'de-b2b-xrechnung',
    name: 'German B2B — XRechnung',
    market: 'germany',
    formatId: 'xrechnung-ubl',
    description: 'A Berlin engineering firm invoicing a German buyer, with the buyer reference the BR-DE rules require.',
    apply: (base) => ({
      ...base,
      seller: {
        ...base.seller,
        name: 'Nordlicht Systeme GmbH',
        vatId: 'DE289417635',
        taxRegistrationId: '29/815/04471',
        companyId: 'HRB 148920 B',
        street: 'Chausseestraße 112',
        city: 'Berlin',
        postCode: '10115',
        countryCode: 'DE',
        contactName: 'Buchhaltung',
        email: 'rechnungen@nordlicht-systeme.example',
        phone: '+49 30 5490 1180',
        electronicAddress: 'rechnungen@nordlicht-systeme.example',
        electronicAddressScheme: 'EM',
      },
      buyer: {
        ...base.buyer,
        name: 'Weserwerk Maschinenbau AG',
        vatId: 'DE315008842',
        street: 'Hafenstraße 7',
        city: 'Bremen',
        postCode: '28217',
        countryCode: 'DE',
        contactName: 'Kreditorenbuchhaltung',
        email: 'kreditoren@weserwerk.example',
        electronicAddress: 'kreditoren@weserwerk.example',
        electronicAddressScheme: 'EM',
      },
      document: {
        ...base.document,
        currency: 'EUR',
        // BT-10. For public-sector buyers this is the Leitweg-ID; a B2B buyer
        // supplies their own reference. Never invented — this is example data.
        buyerReference: 'BST-2026-00417',
        orderReference: '4500219883',
        paymentTerms: 'Zahlbar innerhalb von 30 Tagen ohne Abzug.',
      },
      lines: [
        line('Steuerungssoftware — Entwicklung', '48', 'HUR', '128.00', '19', 'S', 'ENT-STG'),
        line('Inbetriebnahme vor Ort', '3', 'DAY', '1450.00', '19', 'S', 'INB-VO'),
        line('Technische Dokumentation', '1', 'C62', '2400.00', '7', 'S', 'DOK-TD'),
      ],
      payment: {
        ...base.payment,
        meansTypeCode: '58',
        accountName: 'Nordlicht Systeme GmbH',
        accountId: 'DE02120300000000202051',
        providerId: 'BYLADEM1001',
        remittance: 'Rechnungsnummer angeben',
      },
    }),
  },

  {
    id: 'eu-cross-border',
    name: 'EU cross-border — reverse charge',
    market: 'eu',
    formatId: 'en16931-ubl',
    description:
      'A Dutch supplier invoicing a French business. Uses the reverse-charge category, which requires the buyer’s VAT ID and a stated reason.',
    apply: (base) => ({
      ...base,
      seller: {
        ...base.seller,
        name: 'Kade & Vermeer B.V.',
        vatId: 'NL861204488B01',
        companyId: '74102993',
        street: 'Prinsengracht 402',
        city: 'Amsterdam',
        postCode: '1016 JB',
        countryCode: 'NL',
        contactName: 'Finance',
        email: 'invoicing@kadevermeer.example',
      },
      buyer: {
        ...base.buyer,
        name: 'Ateliers Rivière SAS',
        // Required by BR-AE-02 for reverse charge — the invoice fails without it.
        vatId: 'FR40303265045',
        street: '18 Rue Lafayette',
        city: 'Lyon',
        postCode: '69003',
        countryCode: 'FR',
        contactName: 'Comptabilité fournisseurs',
        email: 'compta@ateliersriviere.example',
      },
      document: {
        ...base.document,
        currency: 'EUR',
        buyerReference: 'CMD-2026-0553',
        orderReference: 'CMD-2026-0553',
        paymentTerms: 'Payment within 45 days of the invoice date.',
        note: 'VAT reverse charge — the recipient accounts for the VAT.',
      },
      lines: [
        line('Industrial design retainer', '1', 'MON', '6800.00', '0', 'AE', 'RET-DES'),
        line('Prototype tooling', '2', 'C62', '1875.00', '0', 'AE', 'PRO-TOOL'),
      ],
      payment: {
        ...base.payment,
        meansTypeCode: '58',
        accountName: 'Kade & Vermeer B.V.',
        accountId: 'NL91ABNA0417164300',
        providerId: 'ABNANL2A',
      },
      exemptionReasons: {
        AE: 'Reverse charge — VAT to be accounted for by the recipient (Article 196, Council Directive 2006/112/EC).',
      },
    }),
  },

  {
    id: 'us-services',
    name: 'US services invoice',
    market: 'us',
    formatId: 'commercial',
    description:
      'A New York studio billing a US client. Sales tax is entered manually — Stampbench does not determine US tax rates.',
    apply: (base) => ({
      ...base,
      seller: {
        ...base.seller,
        name: 'Harbor Line Studio LLC',
        taxRegistrationId: '87-2049183',
        street: '55 Vandam Street, Floor 4',
        city: 'New York',
        subdivision: 'NY',
        postCode: '10013',
        countryCode: 'US',
        contactName: 'Billing',
        email: 'billing@harborlinestudio.example',
        phone: '+1 212 555 0147',
      },
      buyer: {
        ...base.buyer,
        name: 'Cedarbrook Software Inc.',
        street: '900 Marquette Avenue, Suite 1200',
        city: 'Minneapolis',
        subdivision: 'MN',
        postCode: '55402',
        countryCode: 'US',
        contactName: 'Accounts Payable',
        email: 'ap@cedarbrooksoftware.example',
      },
      document: {
        ...base.document,
        currency: 'USD',
        orderReference: 'PO-4471',
        paymentTerms: 'Net 30.',
      },
      lines: [
        line('Brand system design', '1', 'C62', '18500.00', '0', 'O', 'DES-BRAND'),
        line('Design engineering support', '32', 'HUR', '185.00', '0', 'O', 'ENG-SUP'),
      ],
      payment: {
        ...base.payment,
        meansTypeCode: '30',
        accountName: 'Harbor Line Studio LLC',
        accountId: '0041958372',
        providerId: '021000021',
      },
      exemptionReasons: { O: 'Services not subject to sales tax in the purchaser’s jurisdiction.' },
    }),
  },

  {
    id: 'saas-subscription',
    name: 'SaaS subscription',
    market: 'eu',
    formatId: 'en16931-ubl',
    description: 'A recurring monthly subscription with per-seat pricing and a discounted annual add-on.',
    apply: (base) => ({
      ...base,
      seller: {
        ...base.seller,
        name: 'Fernpost Software GmbH',
        vatId: 'DE331847220',
        street: 'Sonnenallee 84',
        city: 'Berlin',
        postCode: '12045',
        countryCode: 'DE',
        email: 'billing@fernpost.example',
      },
      buyer: {
        ...base.buyer,
        name: 'Almeida Logística Lda',
        vatId: 'PT508941226',
        street: 'Avenida da Liberdade 220',
        city: 'Lisboa',
        postCode: '1250-147',
        countryCode: 'PT',
        email: 'contas@almeidalogistica.example',
      },
      document: {
        ...base.document,
        currency: 'EUR',
        buyerReference: 'SUB-2026-0088',
        paymentTerms: 'Charged monthly in advance. Payment within 14 days.',
      },
      lines: [
        line('Platform subscription — 45 seats', '45', 'MON', '18.00', '0', 'AE', 'SUB-SEAT'),
        line('Priority support add-on', '1', 'MON', '240.00', '0', 'AE', 'SUB-SUP'),
      ],
      payment: {
        ...base.payment,
        meansTypeCode: '58',
        accountName: 'Fernpost Software GmbH',
        accountId: 'DE02120300000000202051',
        providerId: 'BYLADEM1001',
      },
      exemptionReasons: {
        AE: 'Reverse charge — VAT to be accounted for by the recipient (Article 196, Council Directive 2006/112/EC).',
      },
    }),
  },

  {
    id: 'freelance',
    name: 'Freelance invoice',
    market: 'uk',
    formatId: 'en16931-ubl',
    description:
      'A sole trader who is not VAT registered. Uses category O (not subject to VAT), which needs a stated reason and a tax registration identifier — EN 16931 has no category for "no tax reference at all".',
    apply: (base) => ({
      ...base,
      seller: {
        ...base.seller,
        name: 'J. Okafor Design',
        // BT-32. Every VAT category's -02 rule requires the seller to carry
        // either a VAT identifier (BT-31) or a tax registration (BT-32); a
        // sole trader who is not VAT registered still has a tax reference,
        // and without one the document cannot be valid under any category.
        taxRegistrationId: '4837192056',
        street: 'Studio 6, 12 Bevin Court',
        city: 'Bristol',
        postCode: 'BS1 4TR',
        countryCode: 'GB',
        email: 'hello@jokafordesign.example',
      },
      buyer: {
        ...base.buyer,
        name: 'Broadway Magazine Ltd',
        vatId: 'GB114927382',
        street: '2 Colston Avenue',
        city: 'Bristol',
        postCode: 'BS1 4ST',
        countryCode: 'GB',
        email: 'accounts@broadwaymagazine.example',
      },
      document: {
        ...base.document,
        currency: 'GBP',
        buyerReference: 'BM-ADV-2026-04',
        paymentTerms: 'Payment within 14 days.',
        note: 'Not registered for VAT.',
      },
      lines: [
        line('Monthly advertising design retainer', '1', 'MON', '1200.00', '', 'O', 'RET-ADV'),
        line('Additional artwork revisions', '4', 'HUR', '65.00', '', 'O'),
      ],
      exemptionReasons: { O: 'Not registered for VAT — no VAT charged on this supply.' },
      payment: {
        ...base.payment,
        meansTypeCode: '30',
        accountName: 'J Okafor Design',
        accountId: '77284419',
        providerId: '04-00-75',
      },
    }),
  },
];

export function templatesForMarket(market: MarketId): InvoiceTemplate[] {
  // The market's own templates first, then the rest — a UK visitor should see
  // the UK example at the top but is not prevented from loading the German one.
  return [...TEMPLATES].sort((a, b) => Number(b.market === market) - Number(a.market === market));
}

export function getTemplate(id: string): InvoiceTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Apply a template on top of a fresh draft for its own market. */
export function applyTemplate(template: InvoiceTemplate, now: Date, sequence: number): InvoiceDraft {
  const base = emptyDraft(template.market, now, sequence);
  return { ...template.apply(base), market: template.market, formatId: template.formatId };
}
