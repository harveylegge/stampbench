/**
 * Country data for the invoice builder.
 *
 * An address form that shows "State" to a German seller and "Province" to a
 * British one is the tell that a product was built for one market and
 * translated. The fields, their labels and their order come from here so the
 * form can be genuinely local without the components knowing anything about
 * jurisdictions.
 *
 * What is *not* here: tax rates. Rates change by legislation and by the thing
 * being sold, and a wrong default rate on a compliance document is worse than
 * no default at all — Stampbench checks that the arithmetic and the category
 * are consistent, it does not decide what rate applies to your transaction.
 * The only rate-like data below is `commonVatRates`, offered as suggestions in
 * a dropdown the user can always override, and labelled as such in the UI.
 */
import type { MarketId } from '@/lib/markets';

/** How bank details are expressed. Drives which payment fields appear. */
export type BankScheme = 'iban' | 'uk' | 'us';

export interface Subdivision {
  code: string;
  name: string;
}

export interface CountryDef {
  /** ISO 3166-1 alpha-2 — BT-40 / BT-55. */
  code: string;
  name: string;
  /** Default document currency (BT-5) when this is the seller's country. */
  currency: string;
  /** BCP 47 tag used to format amounts — a US invoice must not read "US$". */
  locale: string;
  /** In the EU VAT area — decides whether intra-community categories apply. */
  inEu: boolean;
  /** Which Stampbench market this country belongs to. */
  market: MarketId;
  address: {
    streetLabel: string;
    cityLabel: string;
    postCodeLabel: string;
    /** Undefined means the field is not shown for this country at all. */
    subdivisionLabel?: string;
    /** True where a postal address is not usable without it. */
    subdivisionRequired?: boolean;
    postCodePlaceholder?: string;
    /** Subdivision list; free text when absent. */
    subdivisions?: Subdivision[];
  };
  bank: BankScheme;
  /** BT-31 / BT-48 label — what this country calls its VAT identifier. */
  taxIdLabel: string;
  taxIdPlaceholder?: string;
  /** BT-30 label — company register identifier, where one is customary. */
  companyIdLabel?: string;
  /** Suggestions only. Never applied automatically, never presented as law. */
  commonVatRates?: number[];
}

const US_STATES: Subdivision[] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
  ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
  ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
].map(([code, name]) => ({ code: code as string, name: name as string }));

const CA_PROVINCES: Subdivision[] = [
  ['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'], ['NB', 'New Brunswick'],
  ['NL', 'Newfoundland and Labrador'], ['NS', 'Nova Scotia'], ['NT', 'Northwest Territories'],
  ['NU', 'Nunavut'], ['ON', 'Ontario'], ['PE', 'Prince Edward Island'], ['QC', 'Quebec'],
  ['SK', 'Saskatchewan'], ['YT', 'Yukon'],
].map(([code, name]) => ({ code: code as string, name: name as string }));

/** Address shape shared by most of continental Europe. */
function euAddress(postCodePlaceholder: string) {
  return {
    streetLabel: 'Street and number',
    cityLabel: 'City',
    postCodeLabel: 'Postal code',
    postCodePlaceholder,
  };
}

export const COUNTRIES: CountryDef[] = [
  {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    locale: 'en-GB',
    inEu: false,
    market: 'uk',
    address: {
      streetLabel: 'Address',
      cityLabel: 'Town or city',
      postCodeLabel: 'Postcode',
      subdivisionLabel: 'County (optional)',
      postCodePlaceholder: 'EC1A 1BB',
    },
    bank: 'uk',
    taxIdLabel: 'VAT number',
    taxIdPlaceholder: 'GB123456789',
    companyIdLabel: 'Company number',
    commonVatRates: [20, 5, 0],
  },
  {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    locale: 'de-DE',
    inEu: true,
    market: 'germany',
    address: {
      streetLabel: 'Straße und Hausnummer',
      cityLabel: 'Ort',
      postCodeLabel: 'PLZ',
      postCodePlaceholder: '10115',
    },
    bank: 'iban',
    taxIdLabel: 'USt-IdNr. (VAT ID)',
    taxIdPlaceholder: 'DE123456789',
    companyIdLabel: 'Handelsregisternummer',
    commonVatRates: [19, 7, 0],
  },
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    locale: 'en-US',
    inEu: false,
    market: 'us',
    address: {
      streetLabel: 'Street address',
      cityLabel: 'City',
      postCodeLabel: 'ZIP code',
      subdivisionLabel: 'State',
      subdivisionRequired: true,
      postCodePlaceholder: '10013',
      subdivisions: US_STATES,
    },
    bank: 'us',
    taxIdLabel: 'EIN / Tax ID',
    taxIdPlaceholder: '12-3456789',
    companyIdLabel: 'State registration number',
  },
  {
    code: 'FR',
    name: 'France',
    currency: 'EUR',
    locale: 'fr-FR',
    inEu: true,
    market: 'eu',
    address: euAddress('69003'),
    bank: 'iban',
    taxIdLabel: 'Numéro de TVA',
    taxIdPlaceholder: 'FR40303265045',
    companyIdLabel: 'SIRET',
    commonVatRates: [20, 10, 5.5, 2.1, 0],
  },
  {
    code: 'IT',
    name: 'Italy',
    currency: 'EUR',
    locale: 'it-IT',
    inEu: true,
    market: 'eu',
    address: euAddress('20121'),
    bank: 'iban',
    taxIdLabel: 'Partita IVA',
    taxIdPlaceholder: 'IT12345678901',
    companyIdLabel: 'Codice fiscale',
    commonVatRates: [22, 10, 5, 4, 0],
  },
  {
    code: 'ES',
    name: 'Spain',
    currency: 'EUR',
    locale: 'es-ES',
    inEu: true,
    market: 'eu',
    address: euAddress('28013'),
    bank: 'iban',
    taxIdLabel: 'NIF / VAT ID',
    taxIdPlaceholder: 'ESA12345674',
    commonVatRates: [21, 10, 4, 0],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    currency: 'EUR',
    locale: 'nl-NL',
    inEu: true,
    market: 'eu',
    address: euAddress('1012 AB'),
    bank: 'iban',
    taxIdLabel: 'BTW-nummer',
    taxIdPlaceholder: 'NL123456789B01',
    companyIdLabel: 'KvK number',
    commonVatRates: [21, 9, 0],
  },
  {
    code: 'BE',
    name: 'Belgium',
    currency: 'EUR',
    locale: 'nl-BE',
    inEu: true,
    market: 'eu',
    address: euAddress('1000'),
    bank: 'iban',
    taxIdLabel: 'BTW / TVA number',
    taxIdPlaceholder: 'BE0123456789',
    commonVatRates: [21, 12, 6, 0],
  },
  {
    code: 'AT',
    name: 'Austria',
    currency: 'EUR',
    locale: 'de-AT',
    inEu: true,
    market: 'eu',
    address: euAddress('1010'),
    bank: 'iban',
    taxIdLabel: 'UID-Nummer',
    taxIdPlaceholder: 'ATU12345678',
    commonVatRates: [20, 13, 10, 0],
  },
  {
    code: 'IE',
    name: 'Ireland',
    currency: 'EUR',
    locale: 'en-IE',
    inEu: true,
    market: 'eu',
    address: {
      streetLabel: 'Address',
      cityLabel: 'Town or city',
      postCodeLabel: 'Eircode',
      subdivisionLabel: 'County',
      postCodePlaceholder: 'D02 XY45',
    },
    bank: 'iban',
    taxIdLabel: 'VAT number',
    taxIdPlaceholder: 'IE1234567FA',
    commonVatRates: [23, 13.5, 9, 0],
  },
  {
    code: 'PL',
    name: 'Poland',
    currency: 'PLN',
    locale: 'pl-PL',
    inEu: true,
    market: 'eu',
    address: euAddress('00-001'),
    bank: 'iban',
    taxIdLabel: 'NIP / VAT ID',
    taxIdPlaceholder: 'PL1234567890',
    commonVatRates: [23, 8, 5, 0],
  },
  {
    code: 'SE',
    name: 'Sweden',
    currency: 'SEK',
    locale: 'sv-SE',
    inEu: true,
    market: 'eu',
    address: euAddress('111 20'),
    bank: 'iban',
    taxIdLabel: 'VAT number',
    taxIdPlaceholder: 'SE123456789001',
    commonVatRates: [25, 12, 6, 0],
  },
  {
    code: 'DK',
    name: 'Denmark',
    currency: 'DKK',
    locale: 'da-DK',
    inEu: true,
    market: 'eu',
    address: euAddress('1050'),
    bank: 'iban',
    taxIdLabel: 'CVR / VAT number',
    taxIdPlaceholder: 'DK12345678',
    commonVatRates: [25, 0],
  },
  {
    code: 'FI',
    name: 'Finland',
    currency: 'EUR',
    locale: 'fi-FI',
    inEu: true,
    market: 'eu',
    address: euAddress('00100'),
    bank: 'iban',
    taxIdLabel: 'ALV / VAT number',
    taxIdPlaceholder: 'FI12345678',
    commonVatRates: [25.5, 14, 10, 0],
  },
  {
    code: 'PT',
    name: 'Portugal',
    currency: 'EUR',
    locale: 'pt-PT',
    inEu: true,
    market: 'eu',
    address: euAddress('1100-148'),
    bank: 'iban',
    taxIdLabel: 'NIF / VAT number',
    taxIdPlaceholder: 'PT123456789',
    commonVatRates: [23, 13, 6, 0],
  },
  {
    code: 'CZ',
    name: 'Czechia',
    currency: 'CZK',
    locale: 'cs-CZ',
    inEu: true,
    market: 'eu',
    address: euAddress('110 00'),
    bank: 'iban',
    taxIdLabel: 'DIČ / VAT ID',
    taxIdPlaceholder: 'CZ12345678',
    commonVatRates: [21, 12, 0],
  },
  {
    code: 'LU',
    name: 'Luxembourg',
    currency: 'EUR',
    locale: 'fr-LU',
    inEu: true,
    market: 'eu',
    address: euAddress('1111'),
    bank: 'iban',
    taxIdLabel: 'VAT number',
    taxIdPlaceholder: 'LU12345678',
    commonVatRates: [17, 14, 8, 3, 0],
  },
  {
    code: 'NO',
    name: 'Norway',
    currency: 'NOK',
    locale: 'nb-NO',
    inEu: false,
    market: 'multi',
    address: euAddress('0150'),
    bank: 'iban',
    taxIdLabel: 'Organisasjonsnummer / MVA',
    taxIdPlaceholder: 'NO123456789MVA',
    commonVatRates: [25, 15, 12, 0],
  },
  {
    code: 'CH',
    name: 'Switzerland',
    currency: 'CHF',
    locale: 'de-CH',
    inEu: false,
    market: 'multi',
    address: euAddress('8001'),
    bank: 'iban',
    taxIdLabel: 'UID / MWST number',
    taxIdPlaceholder: 'CHE-123.456.789 MWST',
    commonVatRates: [8.1, 3.8, 2.6, 0],
  },
  {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    locale: 'en-CA',
    inEu: false,
    market: 'multi',
    address: {
      streetLabel: 'Street address',
      cityLabel: 'City',
      postCodeLabel: 'Postal code',
      subdivisionLabel: 'Province',
      subdivisionRequired: true,
      postCodePlaceholder: 'M5H 2N2',
      subdivisions: CA_PROVINCES,
    },
    bank: 'us',
    taxIdLabel: 'GST/HST number',
    taxIdPlaceholder: '123456789RT0001',
  },
  {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    locale: 'en-AU',
    inEu: false,
    market: 'multi',
    address: {
      streetLabel: 'Street address',
      cityLabel: 'Suburb or city',
      postCodeLabel: 'Postcode',
      subdivisionLabel: 'State',
      subdivisionRequired: true,
      postCodePlaceholder: '2000',
    },
    bank: 'us',
    taxIdLabel: 'ABN',
    taxIdPlaceholder: '12 345 678 901',
    commonVatRates: [10, 0],
  },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** A country that is not in the table still needs a usable form. */
export const GENERIC_COUNTRY: CountryDef = {
  code: '',
  name: 'Other',
  currency: 'EUR',
  locale: 'en-GB',
  inEu: false,
  market: 'multi',
  address: {
    streetLabel: 'Street address',
    cityLabel: 'City',
    postCodeLabel: 'Postal code',
    subdivisionLabel: 'Region (optional)',
  },
  bank: 'iban',
  taxIdLabel: 'Tax identifier',
};

export function getCountry(code: string | undefined): CountryDef {
  if (!code) return GENERIC_COUNTRY;
  return BY_CODE.get(code.toUpperCase()) ?? { ...GENERIC_COUNTRY, code: code.toUpperCase() };
}

export function isKnownCountry(code: string | undefined): boolean {
  return !!code && BY_CODE.has(code.toUpperCase());
}

/** Countries offered in a picker, alphabetical. */
export const COUNTRY_OPTIONS = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));

/** Currencies offered in the currency picker, most-used first. */
export const CURRENCY_OPTIONS = ['EUR', 'GBP', 'USD', 'CHF', 'SEK', 'DKK', 'NOK', 'PLN', 'CZK', 'CAD', 'AUD'];

/**
 * The trade relationship between two countries, which is what decides whether
 * the intra-community and export VAT categories are even offered.
 *
 * This describes the *shape* of the transaction, not its tax treatment: only
 * the user knows whether their supply is actually exempt, and Stampbench never
 * guesses. It exists so the category list stops offering "intra-community
 * supply" on an invoice between two British companies.
 */
export type TradeRelation = 'domestic' | 'intra-eu' | 'eu-export' | 'cross-border';

export function tradeRelation(sellerCode?: string, buyerCode?: string): TradeRelation {
  if (!sellerCode || !buyerCode) return 'domestic';
  const seller = getCountry(sellerCode);
  const buyer = getCountry(buyerCode);
  if (seller.code === buyer.code) return 'domestic';
  if (seller.inEu && buyer.inEu) return 'intra-eu';
  if (seller.inEu && !buyer.inEu) return 'eu-export';
  return 'cross-border';
}

export function isCrossBorder(sellerCode?: string, buyerCode?: string): boolean {
  return !!sellerCode && !!buyerCode && sellerCode.toUpperCase() !== buyerCode.toUpperCase();
}
