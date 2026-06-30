"use client"

import { Card, CardContent } from "@/components/ui"
import { formatCurrency, cn } from "@/lib/utils"

interface InvoiceTotalsProps {
  subtotal: number
  gst: number
  qst: number
  total: number
  variant?: "card" | "inline"
  className?: string
}

export default function InvoiceTotals({
  subtotal,
  gst,
  qst,
  total,
  variant = "card",
  className,
}: InvoiceTotalsProps) {
  const content = (
    <>
      <div className="flex justify-between text-sm">
        <span className="text-muted">Subtotal</span>
        <span className="font-semibold text-heading tabular-nums">{formatCurrency(subtotal)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">GST (5%)</span>
        <span className="text-body tabular-nums">{formatCurrency(gst)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">QST (9.975%)</span>
        <span className="text-body tabular-nums">{formatCurrency(qst)}</span>
      </div>
      <div className="border-t border-border pt-2 flex justify-between text-base">
        <span className="font-bold text-heading">Total</span>
        <span className="font-bold text-heading tabular-nums">{formatCurrency(total)}</span>
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
    <div className={cn("border-t border-border pt-4 space-y-1.5 text-sm ml-auto w-64", className)}>
      {content}
    </div>
  )
}
