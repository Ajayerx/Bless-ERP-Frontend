"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { BarChart3, TrendingUp, Package, FileText, Receipt, Loader2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui"
import { reportService, type TaxSummary } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

type ReportTab = "sales-summary" | "stock-report" | "tax-summary"

const sidebarItems: { id: ReportTab; label: string; icon: React.ReactNode; section: string }[] = [
  { id: "sales-summary", label: "Sales Summary", icon: <BarChart3 size={15} />, section: "Sales" },
  { id: "stock-report", label: "Stock Report", icon: <Package size={15} />, section: "Inventory" },
  { id: "tax-summary", label: "GST/QST Summary", icon: <FileText size={15} />, section: "Tax" },
]

function SalesSummaryPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-[16px] bg-gray-100 flex items-center justify-center mb-4">
        <BarChart3 size={32} className="text-gray-300" />
      </div>
      <p className="text-base font-semibold text-heading">Sales Summary</p>
      <p className="text-sm text-muted mt-1">Detailed sales reports coming soon.</p>
    </div>
  )
}

function StockReportPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-[16px] bg-gray-100 flex items-center justify-center mb-4">
        <Package size={32} className="text-gray-300" />
      </div>
      <p className="text-base font-semibold text-heading">Stock Report</p>
      <p className="text-sm text-muted mt-1">Inventory valuation and movement reports coming soon.</p>
    </div>
  )
}

function TaxSummaryReport() {
  const [data, setData] = useState<TaxSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reportService.getTaxSummary().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-muted" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-heading">GST/QST Tax Summary</h2>
        <p className="text-sm text-muted mt-0.5">Period: {data.period}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Sales</p>
            <p className="text-2xl font-bold text-heading mt-1.5 tabular-nums">{formatCurrency(data.totalSales)}</p>
            <p className="text-xs text-muted mt-0.5">Before tax</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">GST Collected</p>
            <p className="text-2xl font-bold text-primary-600 mt-1.5 tabular-nums">{formatCurrency(data.totalGst)}</p>
            <p className="text-xs text-muted mt-0.5">5% rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">QST Collected</p>
            <p className="text-2xl font-bold text-purple-600 mt-1.5 tabular-nums">{formatCurrency(data.totalQst)}</p>
            <p className="text-xs text-muted mt-0.5">9.975% rate</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary-50 to-surface border-primary-100">
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Tax Collected</p>
            <p className="text-2xl font-bold text-heading mt-1.5 tabular-nums">{formatCurrency(data.totalTax)}</p>
            <p className="text-xs text-muted mt-0.5">GST + QST</p>
          </CardContent>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Transaction Breakdown</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Invoice</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Date</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted uppercase tracking-wider">Subtotal</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-primary-600 uppercase tracking-wider">GST</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-purple-600 uppercase tracking-wider">QST</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.breakdown.map((row) => (
                <tr key={row.invoiceNumber} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-heading">{row.invoiceNumber}</td>
                  <td className="px-6 py-4 text-sm text-body">{row.customerName}</td>
                  <td className="px-6 py-4 text-xs text-muted">{formatDate(row.issueDate)}</td>
                  <td className="px-6 py-4 text-right text-sm tabular-nums text-body">{formatCurrency(row.subtotal)}</td>
                  <td className="px-6 py-4 text-right text-sm tabular-nums text-primary-600 font-semibold">
                    {row.gst > 0 ? formatCurrency(row.gst) : "—"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm tabular-nums text-purple-600 font-semibold">
                    {row.qst > 0 ? formatCurrency(row.qst) : "—"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm tabular-nums font-semibold text-heading">
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50/80">
              <tr>
                <td colSpan={3} className="px-6 py-4 text-sm font-bold text-heading">Totals</td>
                <td className="px-6 py-4 text-right text-sm font-bold tabular-nums text-heading">
                  {formatCurrency(data.breakdown.reduce((s, r) => s + r.subtotal, 0))}
                </td>
                <td className="px-6 py-4 text-right text-sm font-bold tabular-nums text-primary-600">{formatCurrency(data.totalGst)}</td>
                <td className="px-6 py-4 text-right text-sm font-bold tabular-nums text-purple-600">{formatCurrency(data.totalQst)}</td>
                <td className="px-6 py-4 text-right text-sm font-bold tabular-nums text-heading">
                  {formatCurrency(data.breakdown.reduce((s, r) => s + r.total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>("tax-summary")

  const sections = ["Sales", "Inventory", "Tax"]

  return (
    <>
      <Topbar />
      <div className="flex h-[calc(100vh-4rem)]">
        <aside className="w-56 shrink-0 border-r border-border bg-surface overflow-y-auto">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-heading">Reports</h2>
          </div>
          <nav className="p-3 space-y-4">
            {sections.map((section) => (
              <div key={section}>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider px-2 mb-1">
                  {section}
                </p>
                <div className="space-y-0.5">
                  {sidebarItems
                    .filter((item) => item.section === section)
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        disabled={item.id !== "tax-summary"}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-left transition-colors",
                          activeTab === item.id
                            ? "bg-primary-50 text-primary-600 font-semibold"
                            : "text-muted hover:bg-gray-100 hover:text-body",
                          item.id !== "tax-summary" && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === "sales-summary" && <SalesSummaryPlaceholder />}
            {activeTab === "stock-report" && <StockReportPlaceholder />}
            {activeTab === "tax-summary" && <TaxSummaryReport />}
          </motion.div>
        </main>
      </div>
    </>
  )
}
