import {
  generateUblInvoice,
  validateXml,
  type Invoice,
  type Profile,
  type ValidateXmlResult,
} from "@stampbench/core"

import { orderToInvoice } from "./order-to-invoice"
import type {
  EInvoiceOrder,
  EInvoiceOverrides,
  EInvoiceResult,
  StampbenchOptions,
} from "./types"

/**
 * E-invoicing service registered under the `stampbench` module.
 *
 * Resolves anywhere a Medusa container is available:
 *
 * ```ts
 * const stampbench = container.resolve<StampbenchEInvoiceService>(STAMPBENCH_MODULE)
 * const { xml, validation } = stampbench.generate(order)
 * ```
 */
export default class StampbenchEInvoiceService {
  static identifier = "stampbench"

  protected options_: StampbenchOptions

  constructor(_cradle: Record<string, unknown>, options: StampbenchOptions = {}) {
    this.options_ = options
  }

  getOptions(): StampbenchOptions {
    return this.options_
  }

  protected profile(): Profile {
    return this.options_.profile ?? "xrechnung"
  }

  /** Map an order to the EN 16931 semantic model without generating XML. */
  buildInvoice(order: EInvoiceOrder, overrides: EInvoiceOverrides = {}): Invoice {
    return orderToInvoice(order, this.options_, overrides)
  }

  /**
   * Generate a UBL e-invoice for an order and validate it in the same pass.
   * Always returns the document — `validation.violations` tells you whether
   * it is compliant, and a non-empty list is a configuration signal (usually
   * missing seller or payment details), not an exception.
   */
  generate(order: EInvoiceOrder, overrides: EInvoiceOverrides = {}): EInvoiceResult {
    const invoice = this.buildInvoice(order, overrides)
    const profile = this.profile()
    const xml = generateUblInvoice(invoice, { profile })
    const validation = validateXml(xml, { profile })
    return { xml, invoice, validation }
  }

  /** Validate any UBL/CII e-invoice XML against the configured profile. */
  validate(xml: string): ValidateXmlResult {
    return validateXml(xml, { profile: this.profile() })
  }
}
