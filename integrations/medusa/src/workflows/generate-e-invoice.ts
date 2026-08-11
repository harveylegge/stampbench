import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"

import { STAMPBENCH_MODULE } from "../modules/stampbench"
import type StampbenchEInvoiceService from "../modules/stampbench/service"
import type {
  EInvoiceOrder,
  EInvoiceOverrides,
  EInvoiceResult,
} from "../modules/stampbench/types"

/** Order fields the e-invoice mapping consumes. */
export const E_INVOICE_ORDER_FIELDS = [
  "id",
  "display_id",
  "currency_code",
  "email",
  "metadata",
  "customer.company_name",
  "customer.first_name",
  "customer.last_name",
  "customer.metadata",
  "billing_address.*",
  "shipping_address.*",
  "items.id",
  "items.title",
  "items.subtitle",
  "items.product_title",
  "items.variant_sku",
  "items.quantity",
  "items.total",
  "items.tax_total",
  "items.tax_lines.rate",
  "items.tax_lines.code",
  "shipping_methods.name",
  "shipping_methods.total",
  "shipping_methods.tax_total",
  "shipping_methods.tax_lines.rate",
  "shipping_methods.tax_lines.code",
]

export interface GenerateEInvoiceStepInput {
  order: EInvoiceOrder
  overrides?: EInvoiceOverrides
}

export const generateEInvoiceStep = createStep(
  "generate-e-invoice",
  async (input: GenerateEInvoiceStepInput, { container }) => {
    const stampbench = container.resolve<StampbenchEInvoiceService>(STAMPBENCH_MODULE)
    const result = stampbench.generate(input.order, input.overrides)
    return new StepResponse(result)
  },
)

export interface GenerateEInvoiceWorkflowInput {
  order_id: string
  overrides?: EInvoiceOverrides
}

/**
 * Fetch an order and produce a validated EN 16931 / XRechnung e-invoice
 * for it. Returns `{ xml, invoice, validation }`.
 *
 * ```ts
 * const { result } = await generateEInvoiceWorkflow(container).run({
 *   input: { order_id: "order_123" },
 * })
 * ```
 */
export const generateEInvoiceWorkflow = createWorkflow(
  "generate-e-invoice",
  (input: GenerateEInvoiceWorkflowInput) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: E_INVOICE_ORDER_FIELDS,
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    })

    const order = transform({ orders }, ({ orders }) => orders[0] as EInvoiceOrder)

    const result = generateEInvoiceStep({ order, overrides: input.overrides })

    return new WorkflowResponse(result)
  },
)
