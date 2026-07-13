"use client"

import { useEffect, useState } from "react"
import { Receipt, FileText, ArrowUpRight, TrendingUp, Info } from "lucide-react"
import { Card, CardContent, Badge, Button } from "@/components/ui"
import { type SalesInvoiceListResponse } from "@/services"
import { getDefaultTaxTemplate } from "@/services/tax-template"
import { formatCurrency } from "@/lib/utils"

const SALES_DOCTYPE = "Sales Taxes and Charges Template"

interface TaxSummaryProps {
  invoices: SalesInvoiceListResponse | null
}

export default function TaxSummary({ invoices }: TaxSummaryProps) {
  const [gstRate, setGstRate] = useState(0.05)
  const [qstRate, setQstRate] = useState(0.09975)

  useEffect(() => {
    getDefaultTaxTemplate(SALES_DOCTYPE).then((template) => {
      if (template) {
        const gst = template.rows.find((r) => r.accountHead?.toLowerCase().includes("gst"))
        const qst = template.rows.find((r) => r.accountHead?.toLowerCase().includes("qst"))
        if (gst) setGstRate(gst.rate)
        if (qst) setQstRate(qst.rate)
      }
    })
  }, [])

  // NOTE: This splits total_taxes_and_charges by the current template rate ratio.
  // If rates change independently of each other, historical invoices will be
  // misattributed. Replace with a backend aggregation endpoint that reads the
  // actual Sales Taxes and Charges child table when that becomes available.
  const totalTaxAndCharges = invoices?.items?.reduce((s, inv) => s + (inv.total_taxes_and_charges ?? 0), 0) ?? 0
  const combinedRate = gstRate + qstRate
  const gstCollected = combinedRate > 0 ? totalTaxAndCharges * (gstRate / combinedRate) : 0
  const qstCollected = combinedRate > 0 ? totalTaxAndCharges * (qstRate / combinedRate) : 0

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">Tax Summary</h1>
          <p className="text-sm text-muted mt-1">GST/QST collected and filing overview.</p>
        </div>
        <Button variant="outline"><FileText size={16} /> Export</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><TrendingUp size={20} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Tax Collected</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(totalTaxAndCharges)}</p>
                <p className="text-xs text-muted mt-0.5">Across {invoices?.total ?? 0} invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-success-50 text-success-600 flex items-center justify-center shrink-0"><ArrowUpRight size={20} /></div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">GST Collected ({(gstRate * 100).toFixed(1)}%)</p>
                  <span title="GST/QST split is estimated from total tax using the current template rate ratio. See code comment for details.">
                    <Info size={12} className="text-muted cursor-help" />
                  </span>
                </div>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(gstCollected)}</p>
                <p className="text-xs text-muted mt-0.5">Federal tax (estimated split)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0"><Receipt size={20} /></div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">QST Collected ({(qstRate * 100).toFixed(3)}%)</p>
                  <span title="GST/QST split is estimated from total tax using the current template rate ratio. See code comment for details.">
                    <Info size={12} className="text-muted cursor-help" />
                  </span>
                </div>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(qstCollected)}</p>
                <p className="text-xs text-muted mt-0.5">Provincial tax (QC) (estimated split)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h3 className="font-bold text-heading mb-3">Filing Periods</h3>
          <div className="space-y-3">
            {["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"].map((period) => (
              <div key={period} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <FileText size={15} className="text-muted" />
                  <span className="font-semibold text-heading">{period}</span>
                </div>
                <Badge variant="warning">Not Filed</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
