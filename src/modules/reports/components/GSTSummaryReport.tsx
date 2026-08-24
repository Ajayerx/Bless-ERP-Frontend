"use client"

import { Link } from "react-router-dom"
import { Receipt, TrendingUp, DollarSign, FileText, ShoppingCart, ShieldCheck, Banknote, Landmark } from "lucide-react"
import { Card, CardContent } from "@/components/ui"
import { type TaxSummary } from "@/services"
import { formatDate } from "@/lib/utils"
import { GST_RATE, QST_RATE } from "@/config/tax.config"

interface GSTSummaryReportProps {
  report: TaxSummary
}

function fmtCurrency(n: number, currency?: string): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      minimumFractionDigits: 2,
    }).format(n)
  } catch {
    return `$${n.toFixed(2)}`
  }
}

function KpiCard({
  icon,
  iconClass,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  iconClass: string
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent>
          <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 gst-kpi-icon ${iconClass}`}>{icon}</div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold text-heading mt-1 tabular-nums truncate">{value}</p>
            {hint && <p className="text-xs text-muted mt-0.5 truncate">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BreakdownTable({
  report,
  side,
}: {
  report: TaxSummary
  side: "sales" | "purchase"
}) {
  const rows = report.transactions.filter((t) => t.side === side)
  if (rows.length === 0) return null
  const currency = report.currency
  const summary = side === "sales" ? report.sales : report.purchases
  const linkBase = side === "sales" ? "/invoices" : "/bills"
  const title = side === "sales" ? "Sales Transactions" : "Purchase Transactions (ITC)"

  return (
    <Card>
      <CardContent>
        <h3 className="font-bold text-heading mb-3">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm gl-print-table" data-testid={`gst_table_${side}`}>
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Voucher</th>
                <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">{side === "sales" ? "Customer" : "Supplier"}</th>
                <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Date</th>
                <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Subtotal</th>
                <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">GST</th>
                <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">QST</th>
                <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Other</th>
                <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.side}-${row.voucherNo}`} className="border-b border-gray-50">
                  <td className="py-2 font-semibold text-heading whitespace-nowrap">
                    <Link to={`${linkBase}/${encodeURIComponent(row.voucherNo)}`} className="text-primary-600 hover:underline">
                      {row.voucherNo}
                    </Link>
                  </td>
                  <td className="py-2 text-muted">{row.partyName}</td>
                  <td className="py-2 text-muted whitespace-nowrap">{formatDate(row.postingDate)}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{fmtCurrency(row.subtotal, currency)}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{fmtCurrency(row.gst, currency)}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{fmtCurrency(row.qst, currency)}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{fmtCurrency(row.otherTax, currency)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-heading">{fmtCurrency(row.total, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={3} className="py-2 font-bold text-heading">Totals ({summary.count} {side === "sales" ? "invoices" : "bills"})</td>
                <td className="py-2 text-right font-bold tabular-nums text-heading">{fmtCurrency(summary.netTotal, currency)}</td>
                <td className="py-2 text-right font-bold tabular-nums text-heading">{fmtCurrency(summary.gst, currency)}</td>
                <td className="py-2 text-right font-bold tabular-nums text-heading">{fmtCurrency(summary.qst, currency)}</td>
                <td className="py-2 text-right font-bold tabular-nums text-heading">{fmtCurrency(summary.otherTax, currency)}</td>
                <td className="py-2 text-right font-bold tabular-nums text-heading">{fmtCurrency(summary.grandTotal, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export default function GSTSummaryReport({ report }: GSTSummaryReportProps) {
  const currency = report.currency
  const reconciled =
    Math.abs(report.sales.otherTax) < 0.01 &&
    Math.abs(report.purchases.otherTax) < 0.01

  return (
    <div className="space-y-6 gst-report">
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-lg font-bold text-heading">{report.company}</h2>
        <p className="text-sm text-muted mt-0.5">
          {report.period} · {currency}
          {report.companyTaxId ? ` · Business No. ${report.companyTaxId}` : ""}
        </p>
        {!reconciled && (
          <p className="mt-3 text-sm text-warning-600 bg-warning-50 border border-warning-100 px-3 py-2.5 rounded-[10px]">
            Reconciliation note: some transactions carry taxes that could not be classified as GST or QST. They are
            included in the "Other" column and in the total remittance.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign size={16} />}
          iconClass="bg-primary-50 text-primary-600"
          label="Net Sales"
          value={fmtCurrency(report.sales.netTotal, currency)}
          hint={`${report.sales.count} invoices`}
        />
        <KpiCard
          icon={<TrendingUp size={16} />}
          iconClass="bg-primary-50 text-primary-600"
          label="GST Collected"
          value={fmtCurrency(report.sales.gst, currency)}
          hint={`${(GST_RATE * 100).toFixed(1)}% federal`}
        />
        <KpiCard
          icon={<Receipt size={16} />}
          iconClass="bg-warning-50 text-warning-600"
          label="QST Collected"
          value={fmtCurrency(report.sales.qst, currency)}
          hint={`${(QST_RATE * 100).toFixed(3)}% provincial`}
        />
        <KpiCard
          icon={<FileText size={16} />}
          iconClass="bg-success-50 text-success-600"
          label="Total Tax Collected"
          value={fmtCurrency(report.sales.totalTax, currency)}
          hint="GST + QST + Other"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<ShoppingCart size={16} />}
          iconClass="bg-purple-50 text-purple-600"
          label="GST ITC (Purchases)"
          value={fmtCurrency(report.purchases.gst, currency)}
          hint={`${report.purchases.count} bills`}
        />
        <KpiCard
          icon={<ShieldCheck size={16} />}
          iconClass="bg-info-50 text-info-600"
          label="QST ITC (Purchases)"
          value={fmtCurrency(report.purchases.qst, currency)}
          hint="Input tax credits"
        />
        <KpiCard
          icon={<Banknote size={16} />}
          iconClass="bg-success-50 text-success-600"
          label="Net GST Remittance"
          value={fmtCurrency(report.netRemittance.gst, currency)}
          hint="Collected − ITC"
        />
        <KpiCard
          icon={<Landmark size={16} />}
          iconClass="bg-danger-50 text-danger-600"
          label="Net QST Remittance"
          value={fmtCurrency(report.netRemittance.qst, currency)}
          hint="Collected − ITC"
        />
      </div>

      <BreakdownTable report={report} side="sales" />
      <BreakdownTable report={report} side="purchase" />

      <Card>
        <CardContent>
          <h3 className="font-bold text-heading mb-2">Net Remittance Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm gl-print-table" data-testid="gst_remittance_table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Tax</th>
                  <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Collected</th>
                  <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">ITC</th>
                  <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Net Due</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="py-2 font-semibold text-heading">GST ({fmtCurrency(report.sales.gst, currency)} − {fmtCurrency(report.purchases.gst, currency)})</td>
                  <td className="py-2 text-right tabular-nums text-muted">{fmtCurrency(report.sales.gst, currency)}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{fmtCurrency(report.purchases.gst, currency)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-heading">{fmtCurrency(report.netRemittance.gst, currency)}</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-2 font-semibold text-heading">QST ({fmtCurrency(report.sales.qst, currency)} − {fmtCurrency(report.purchases.qst, currency)})</td>
                  <td className="py-2 text-right tabular-nums text-muted">{fmtCurrency(report.sales.qst, currency)}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{fmtCurrency(report.purchases.qst, currency)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-heading">{fmtCurrency(report.netRemittance.qst, currency)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td className="py-2 font-bold text-heading">Total Net Remittance</td>
                  <td colSpan={2} className="py-2" />
                  <td className="py-2 text-right font-bold tabular-nums text-heading">{fmtCurrency(report.netRemittance.total, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
