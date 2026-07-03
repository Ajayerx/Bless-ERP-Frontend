"use client"

import { Receipt, FileText, ArrowUpRight, TrendingUp } from "lucide-react"
import { Card, CardContent, Badge, Button } from "@/components/ui"
import { type InvoiceListResponse } from "@/services"
import { formatCurrency } from "@/lib/utils"
import { GST_RATE, QST_RATE } from "@/config/tax.config"

interface TaxSummaryProps {
  invoices: InvoiceListResponse | null
}

export default function TaxSummary({ invoices }: TaxSummaryProps) {
  const totalCollected = invoices?.items?.reduce((s, inv) => s + inv.total, 0) ?? 0
  const subtotal = totalCollected / (1 + GST_RATE + QST_RATE)
  const gstCollected = subtotal * GST_RATE
  const qstCollected = subtotal * QST_RATE
  const totalTax = gstCollected + qstCollected

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
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(totalTax)}</p>
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
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">GST Collected ({(GST_RATE * 100).toFixed(1)}%)</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(gstCollected)}</p>
                <p className="text-xs text-muted mt-0.5">Federal tax</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0"><Receipt size={20} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">QST Collected ({(QST_RATE * 100).toFixed(3)}%)</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(qstCollected)}</p>
                <p className="text-xs text-muted mt-0.5">Provincial tax (QC)</p>
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
