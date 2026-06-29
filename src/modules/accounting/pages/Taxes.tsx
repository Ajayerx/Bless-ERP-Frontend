"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Landmark, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { accountingService } from "@/services"
import type { TaxSummaryData } from "@/modules/accounting/types"
import { formatCurrency, formatDate } from "@/lib/utils"

export default function Taxes() {
  const [data, setData] = useState<TaxSummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    accountingService.getTaxSummary().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-[16px] bg-gray-100 animate-pulse" />)}
          </div>
        </div>
      </>
    )
  }

  if (!data) return null

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[10px] bg-primary-50 text-primary-600"><Landmark size={20} /></div>
          <div>
            <h1 className="text-2xl font-bold text-heading">Tax Summary</h1>
            <p className="text-sm text-muted mt-1">GST/QST overview for {data.period}.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Collected</p>
              <p className="text-2xl font-bold text-success-600 mt-1.5 tabular-nums">{formatCurrency(data.totalCollected)}</p>
              <div className="flex items-center gap-1 mt-1">
                <ArrowUpRight size={12} className="text-success-600" />
                <span className="text-xs text-muted">From sales</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Paid (ITC)</p>
              <p className="text-2xl font-bold text-warning-600 mt-1.5 tabular-nums">{formatCurrency(data.totalPaid)}</p>
              <div className="flex items-center gap-1 mt-1">
                <ArrowDownRight size={12} className="text-warning-600" />
                <span className="text-xs text-muted">On purchases</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary-50 to-surface border-primary-100">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Net Due</p>
              <p className="text-2xl font-bold text-heading mt-1.5 tabular-nums">{formatCurrency(data.netDue)}</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp size={12} className="text-primary-600" />
                <span className="text-xs text-muted">Payable to CRA</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Period</p>
              <p className="text-2xl font-bold text-heading mt-1.5">{data.period}</p>
              <p className="text-xs text-muted mt-1">Monthly summary</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle>GST Collected vs Paid</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-heading">GST Collected (Sales)</span>
                    <span className="font-semibold text-primary-600 tabular-nums">{formatCurrency(data.gstCollected)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${(data.gstCollected / (data.gstCollected + data.gstPaid || 1)) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-heading">GST Paid (ITC)</span>
                    <span className="font-semibold text-warning-600 tabular-nums">{formatCurrency(data.gstPaid)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-warning-500" style={{ width: `${(data.gstPaid / (data.gstCollected + data.gstPaid || 1)) * 100}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>QST Collected vs Paid</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-heading">QST Collected (Sales)</span>
                    <span className="font-semibold text-purple-600 tabular-nums">{formatCurrency(data.qstCollected)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-purple-500" style={{ width: `${(data.qstCollected / (data.qstCollected + data.qstPaid || 1)) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-heading">QST Paid (ITC)</span>
                    <span className="font-semibold text-warning-600 tabular-nums">{formatCurrency(data.qstPaid)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-warning-500" style={{ width: `${(data.qstPaid / (data.qstCollected + data.qstPaid || 1)) * 100}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          <CardHeader><CardTitle>Transaction Breakdown</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase">Reference</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase">Vendor/Customer</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase">Date</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase">Type</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted uppercase">Subtotal</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-primary-600 uppercase">GST</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-purple-600 uppercase">QST</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.breakdown.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-heading">{row.reference}</td>
                    <td className="px-6 py-4 text-sm text-body">{row.vendorOrCustomer}</td>
                    <td className="px-6 py-4 text-xs text-muted">{formatDate(row.date)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${row.type === "sales" ? "bg-success-50 text-success-700" : "bg-info-50 text-info-700"}`}>
                        {row.type === "sales" ? "Sales" : "Purchase"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums text-body">{formatCurrency(row.subtotal)}</td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums text-primary-600 font-semibold">{row.gst > 0 ? formatCurrency(row.gst) : "—"}</td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums text-purple-600 font-semibold">{row.qst > 0 ? formatCurrency(row.qst) : "—"}</td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums font-semibold text-heading">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </>
  )
}
