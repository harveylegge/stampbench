import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { STAMPBENCH_MODULE } from "../../../../modules/stampbench"
import type StampbenchEInvoiceService from "../../../../modules/stampbench/service"

/**
 * POST /admin/e-invoices/validate
 *
 * Validate any UBL or CII e-invoice document against the configured
 * profile. Body: `{ "xml": "<Invoice …>" }`.
 */
export const POST = async (
  req: MedusaRequest<{ xml?: string }>,
  res: MedusaResponse,
) => {
  const xml = req.body?.xml
  if (typeof xml !== "string" || xml.trim() === "") {
    res.status(400).json({
      message: 'Provide the document to validate as { "xml": "…" }.',
    })
    return
  }

  const stampbench = req.scope.resolve<StampbenchEInvoiceService>(STAMPBENCH_MODULE)
  res.json(stampbench.validate(xml))
}
