"use client"

import { Card, CardContent } from "@/components/ui"
import { formatCurrency, cn } from "@/lib/utils"

export interface TaxLine {
  label: string
  amount: number
}

interface InvoiceTotalsProps {
  subtotal: number
  totalTaxesAndCharges?: number
  discountAmount?: number
  grandTotal: number
  roundingAdjustment?: number
  roundedTotal?: number
  totalAdvance?: number
  outstandingAmount?: number
  taxLines?: TaxLine[]
  // Legacy props for backward compat
  gst?: number
  qst?: number
  gstLabel?: string
  qstLabel?: string
  variant?: "card" | "inline"
  className?: string
}

export default function InvoiceTotals({
  subtotal,
  totalTaxesAndCharges,
  discountAmount = 0,
  grandTotal,
  roundingAdjustment = 0,
  roundedTotal,
  totalAdvance = 0,
  outstandingAmount,
  taxLines,
  gst,
  qst,
  gstLabel,
  qstLabel,
  variant = "card",
  className,
}: InvoiceTotalsProps) {
  const effectiveRoundedTotal = roundedTotal ?? grandTotal + roundingAdjustment
  const effectiveOutstanding = outstandingAmount ?? effectiveRoundedTotal - totalAdvance

  // Build tax display: use taxLines if provided, else fall back to gst/qst legacy props
  const displayTaxLines: TaxLine[] = taxLines && taxLines.length > 0
    ? taxLines
    : [
        ...(gst !== undefined ? [{ label: gstLabel ?? "GST", amount: gst }] : []),
        ...(qst !== undefined ? [{ label: qstLabel ?? "QST", amount: qst }] : []),
      ]

  const content = (
    <>
      <div className="flex justify-between text-sm">
        <span className="text-muted">Net Total</span>
        <span className="font-semibold text-heading tabular-nums">{formatCurrency(subtotal)}</span>
      </div>
      {displayTaxLines.map((t, i) => (
        <div key={i} className="flex justify-between text-sm">
          <span className="text-muted">{t.label}</span>
          <span className="text-body tabular-nums">{formatCurrency(t.amount)}</span>
        </div>
      ))}
      {totalTaxesAndCharges !== undefined && (
        <div className="flex justify-between text-sm">
          <span className="text-muted">Total Taxes & Charges</span>
          <span className="text-body tabular-nums">{formatCurrency(totalTaxesAndCharges)}</span>
        </div>
      )}
      {discountAmount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted">Additional Discount</span>
          <span className="text-danger-600 tabular-nums">-{formatCurrency(discountAmount)}</span>
        </div>
      )}
      <div className="border-t border-border pt-2 mt-1">
        <div className="flex justify-between text-sm">
          <span className="font-bold text-heading">Grand Total</span>
          <span className="font-bold text-heading tabular-nums">{formatCurrency(grandTotal)}</span>
        </div>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">Rounding Adjustment</span>
        <span className="text-body tabular-nums">{formatCurrency(roundingAdjustment)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-heading">Rounded Total (to pay)</span>
        <span className="font-semibold text-heading tabular-nums">{formatCurrency(effectiveRoundedTotal)}</span>
      </div>
      {totalAdvance > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted">Total Advance</span>
          <span className="text-body tabular-nums">{formatCurrency(totalAdvance)}</span>
        </div>
      )}
      <div className="border-t border-border pt-2 mt-1">
        <div className="flex justify-between text-base">
          <span className="font-bold text-heading">Outstanding Amount</span>
          <span className="font-bold text-heading tabular-nums">{formatCurrency(effectiveOutstanding)}</span>
        </div>
      </div>
    </>
  )

  if (variant === "card") {
    return (
      <Card className={cn("w-72", className)}>
        <CardContent className="space-y-2 pt-6">{content}</CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-1.5 text-sm", className)}>
      {content}
    </div>
  )
}
