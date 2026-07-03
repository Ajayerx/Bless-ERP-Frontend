"use client"

import { Receipt, TrendingUp, DollarSign, FileText } from "lucide-react"
import { Card, CardContent } from "@/components/ui"
import { type TaxSummary } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

interface GSTSummaryReportProps {
  report: TaxSummary
}

export default function GSTSummaryReport({ report }: GSTSummaryReportProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><DollarSign size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Sales</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(report.totalSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><TrendingUp size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">GST Collected</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(report.totalGst)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0"><Receipt size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">QST Collected</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(report.totalQst)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center shrink-0"><FileText size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Tax</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(report.totalTax)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h3 className="font-bold text-heading mb-3">Transaction Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Invoice</th>
                  <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Customer</th>
                  <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Date</th>
                  <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Subtotal</th>
                  <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">GST</th>
                  <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">QST</th>
                  <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.breakdown.map((row) => (
                  <tr key={row.invoiceNumber} className="border-b border-gray-50">
                    <td className="py-2 font-semibold text-heading">{row.invoiceNumber}</td>
                    <td className="py-2 text-muted">{row.customerName}</td>
                    <td className="py-2 text-muted">{formatDate(row.issueDate)}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{formatCurrency(row.subtotal)}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{formatCurrency(row.gst)}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{formatCurrency(row.qst)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-heading">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={3} className="py-2 font-bold text-heading">Totals</td>
                  <td className="py-2 text-right font-bold tabular-nums text-heading">{formatCurrency(report.breakdown.reduce((s, r) => s + r.subtotal, 0))}</td>
                  <td className="py-2 text-right font-bold tabular-nums text-heading">{formatCurrency(report.breakdown.reduce((s, r) => s + r.gst, 0))}</td>
                  <td className="py-2 text-right font-bold tabular-nums text-heading">{formatCurrency(report.breakdown.reduce((s, r) => s + r.qst, 0))}</td>
                  <td className="py-2 text-right font-bold tabular-nums text-heading">{formatCurrency(report.breakdown.reduce((s, r) => s + r.total, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
