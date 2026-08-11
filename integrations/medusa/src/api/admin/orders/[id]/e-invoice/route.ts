import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { generateEInvoiceWorkflow } from "../../../../../workflows/generate-e-invoice"

/**
 * GET /admin/orders/:id/e-invoice
 *
 * Generate an EN 16931 / XRechnung e-invoice for an order.
 *
 * Returns the UBL XML as a download by default. Pass `?format=json` to get
 * `{ xml, invoice, validation }` — useful for surfacing rule violations
 * before handing the document to a buyer.
 *
 * Optional query parameters: `invoice_number`, `issue_date`, `due_date`,
 * `buyer_reference`.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id as string
  const query = req.query as Record<string, string | undefined>

  const { result } = await generateEInvoiceWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      overrides: {
        invoiceNumber: query.invoice_number,
        issueDate: query.issue_date,
        dueDate: query.due_date,
        buyerReference: query.buyer_reference,
      },
    },
  })

  if (query.format === "json") {
    res.json({
      xml: result.xml,
      invoice: result.invoice,
      validation: result.validation,
    })
    return
  }

  const filename = `${result.invoice.number ?? orderId}.xml`
  res.setHeader("Content-Type", "application/xml; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
  res.send(result.xml)
}
