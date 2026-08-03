import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  generateXRechnungUbl,
  validateInvoice,
  withComputedTotals,
  withXRechnungDefaults,
  type Invoice,
} from '@invoicegate/core';
import { apiError, gateRequest, readBoundedText } from '@/lib/api';
import { recordUsage } from '@/lib/usage';
import { log } from '@/lib/log';

export const runtime = 'nodejs';

const partySchema = z
  .object({
    name: z.string().optional(),
    tradingName: z.string().optional(),
    identifier: z.string().optional(),
    legalRegistrationId: z.string().optional(),
    vatId: z.string().optional(),
    taxRegistrationId: z.string().optional(),
    electronicAddress: z.string().optional(),
    electronicAddressScheme: z.string().optional(),
    address: z
      .object({
        streetName: z.string().optional(),
        additionalStreet: z.string().optional(),
        city: z.string().optional(),
        postCode: z.string().optional(),
        countrySubdivision: z.string().optional(),
        countryCode: z.string().optional(),
      })
      .optional(),
    contact: z
      .object({
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
      })
      .optional(),
  })
  .optional();

const invoiceSchema = z.object({
  specificationIdentifier: z.string().optional(),
  businessProcessType: z.string().optional(),
  number: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  typeCode: z.string().optional(),
  currencyCode: z.string().optional(),
  buyerReference: z.string().optional(),
  purchaseOrderReference: z.string().optional(),
  contractReference: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.array(z.string().max(5000)).max(50).optional(),
  seller: partySchema,
  buyer: partySchema,
  payment: z
    .object({
      meansTypeCode: z.string().optional(),
      meansText: z.string().optional(),
      remittanceInformation: z.string().optional(),
      creditTransfers: z
        .array(
          z.object({
            iban: z.string().optional(),
            accountName: z.string().optional(),
            bic: z.string().optional(),
          }),
        )
        .max(20)
        .optional(),
      debitedAccountIban: z.string().optional(),
      mandateReference: z.string().optional(),
    })
    .optional(),
  allowancesCharges: z
    .array(
      z.object({
        isCharge: z.boolean(),
        amount: z.number().finite(),
        baseAmount: z.number().finite().optional(),
        percentage: z.number().finite().optional(),
        reason: z.string().optional(),
        reasonCode: z.string().optional(),
        vatCategoryCode: z.string().optional(),
        vatRate: z.number().finite().optional(),
      }),
    )
    .max(200)
    .optional(),
  totals: z
    .object({
      sumOfLineNet: z.number().finite().optional(),
      allowanceTotal: z.number().finite().optional(),
      chargeTotal: z.number().finite().optional(),
      taxExclusive: z.number().finite().optional(),
      taxTotal: z.number().finite().optional(),
      taxInclusive: z.number().finite().optional(),
      paidAmount: z.number().finite().optional(),
      roundingAmount: z.number().finite().optional(),
      amountDue: z.number().finite().optional(),
    })
    .optional(),
  vatBreakdown: z
    .array(
      z.object({
        categoryCode: z.string(),
        rate: z.number().finite().optional(),
        taxableAmount: z.number().finite(),
        taxAmount: z.number().finite(),
        exemptionReason: z.string().optional(),
        exemptionReasonCode: z.string().optional(),
      }),
    )
    .max(100)
    .optional(),
  lines: z
    .array(
      z.object({
        id: z.string().optional(),
        note: z.string().optional(),
        quantity: z.number().finite().optional(),
        unitCode: z.string().optional(),
        netAmount: z.number().finite().optional(),
        orderLineReference: z.string().optional(),
        item: z
          .object({
            name: z.string().optional(),
            description: z.string().optional(),
            sellerItemId: z.string().optional(),
            standardItemId: z.string().optional(),
          })
          .optional(),
        price: z
          .object({
            netPrice: z.number().finite().optional(),
            baseQuantity: z.number().finite().optional(),
            baseQuantityUnit: z.string().optional(),
          })
          .optional(),
        vat: z
          .object({ categoryCode: z.string().optional(), rate: z.number().finite().optional() })
          .optional(),
      }),
    )
    .max(1000)
    .optional(),
});

const requestSchema = z.object({
  invoice: invoiceSchema,
  options: z
    .object({
      profile: z.enum(['xrechnung', 'en16931']).optional(),
      /** Default true: compute BG-22 totals + BG-23 VAT breakdown from lines. */
      computeTotals: z.boolean().optional(),
      /** Default true: run validation and include the result. */
      validate: z.boolean().optional(),
    })
    .optional(),
});

/**
 * POST /api/v1/generate
 * Body: { invoice: <semantic model>, options?: { computeTotals?, validate?, profile? } }
 * Returns: { xml, validation? } — totals are computed for you unless disabled.
 */
export async function POST(request: Request) {
  const gate = await gateRequest(request);
  if (gate instanceof NextResponse) return gate;

  const bodyOrError = await readBoundedText(request);
  if (bodyOrError instanceof NextResponse) return bodyOrError;

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(JSON.parse(bodyOrError));
  } catch (e) {
    const detail = e instanceof z.ZodError ? e.issues.slice(0, 5) : undefined;
    return apiError(400, 'invalid_request', 'Body must be {"invoice": {...}} matching the semantic model.', { detail });
  }

  const options = parsed.options ?? {};
  const shouldComputeTotals = options.computeTotals ?? true;
  const shouldValidate = options.validate ?? true;
  const profile = options.profile ?? 'xrechnung';

  const started = Date.now();
  let invoice = withXRechnungDefaults(parsed.invoice as Invoice);
  if (shouldComputeTotals && (invoice.lines?.length ?? 0) > 0) {
    invoice = withComputedTotals(invoice);
  }
  const xml = generateXRechnungUbl(invoice);
  const validation = shouldValidate ? validateInvoice(invoice, { profile }) : undefined;

  if (gate.caller.type !== 'anon') {
    await recordUsage(gate.caller.userId, 'generate', {
      apiKeyId: gate.caller.type === 'key' ? gate.caller.apiKeyId : null,
      profile,
      ok: validation?.valid ?? true,
    });
  }
  log.info('api.generate', {
    profile,
    valid: validation?.valid,
    ms: Date.now() - started,
    callerType: gate.caller.type,
  });

  return NextResponse.json({ xml, validation }, { headers: gate.headers });
}
