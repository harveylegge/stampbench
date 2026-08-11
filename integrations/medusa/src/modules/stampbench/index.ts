import { Module } from "@medusajs/framework/utils"

import StampbenchEInvoiceService from "./service"

export const STAMPBENCH_MODULE = "stampbench"

export default Module(STAMPBENCH_MODULE, {
  service: StampbenchEInvoiceService,
})

export { StampbenchEInvoiceService }
export { orderToInvoice, toNumber } from "./order-to-invoice"
export type {
  EInvoiceOrder,
  EInvoiceOverrides,
  EInvoiceResult,
  StampbenchOptions,
} from "./types"
