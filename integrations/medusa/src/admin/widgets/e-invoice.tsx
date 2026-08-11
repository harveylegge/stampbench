import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

type ValidationSummary = {
  errors: number
  warnings: number
}

/**
 * Order-detail widget: download the order's XRechnung / EN 16931 e-invoice
 * and see at a glance whether it validates cleanly.
 */
const EInvoiceWidget = ({ data }: DetailWidgetProps<AdminOrder>) => {
  const [summary, setSummary] = useState<ValidationSummary | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/admin/orders/${data.id}/e-invoice?format=json`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${res.status}`))))
      .then((raw) => {
        if (cancelled) return
        const body = raw as { validation?: { violations?: { severity?: string }[] } }
        const violations = body?.validation?.violations ?? []
        setSummary({
          errors: violations.filter((v) => v.severity === "error").length,
          warnings: violations.filter((v) => v.severity === "warning").length,
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [data.id])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">E-Invoice</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            XRechnung / EN 16931 · Stampbench
          </Text>
        </div>
        {summary &&
          (summary.errors === 0 ? (
            <Badge size="2xsmall" color="green">
              Compliant{summary.warnings > 0 ? ` · ${summary.warnings} warning${summary.warnings === 1 ? "" : "s"}` : ""}
            </Badge>
          ) : (
            <Badge size="2xsmall" color="red">
              {summary.errors} rule violation{summary.errors === 1 ? "" : "s"}
            </Badge>
          ))}
        {failed && (
          <Badge size="2xsmall" color="grey">
            Unavailable
          </Badge>
        )}
      </div>
      <div className="px-6 py-4">
        <Button size="small" variant="secondary" asChild>
          <a href={`/admin/orders/${data.id}/e-invoice`} download>
            Download XML
          </a>
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default EInvoiceWidget
