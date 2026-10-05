"use client"

import { Wallet, Calendar, Building2, FileText } from "lucide-react"
import { Card, CardContent, Badge } from "@/components/ui"
import { type Expense } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

const statusVariant: Record<Expense["status"], "success" | "warning" | "danger"> = {
  submitted: "success",
  draft: "warning",
  cancelled: "danger",
}

const statusLabel: Record<Expense["status"], string> = {
  submitted: "Submitted",
  draft: "Draft",
  cancelled: "Cancelled",
}

interface ExpenseDetailCardProps {
  expense: Expense
}

export default function ExpenseDetailCard({ expense }: ExpenseDetailCardProps) {
  const lines = expense.lines

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-[12px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
          <Wallet size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-heading">{expense.remark || expense.title || expense.name}</h1>
          <p className="text-sm text-muted">{expense.name} · {expense.voucherType}</p>
        </div>
        <Badge variant={statusVariant[expense.status]} className="ml-auto">{statusLabel[expense.status]}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <FileText size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Amount</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(expense.amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Calendar size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Posting Date</p>
                <p className="text-2xl font-bold text-heading mt-1">{formatDate(expense.postingDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Wallet size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Expense Account</p>
                <p className="text-lg font-bold text-heading mt-1">{expense.expenseAccount || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Building2 size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Paid From</p>
                <p className="text-lg font-bold text-heading mt-1">{expense.paidFrom || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <h3 className="font-bold text-heading">Accounts</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted border-b border-border">
                  <th className="text-left pb-2 pr-3 font-semibold">Account</th>
                  <th className="text-left pb-2 pr-3 font-semibold">Party</th>
                  <th className="text-right pb-2 pr-3 font-semibold">Debit</th>
                  <th className="text-right pb-2 pr-3 font-semibold">Credit</th>
                  <th className="text-left pb-2 font-semibold">Cost Center / Project</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-heading">{line.account || "—"}</td>
                    <td className="py-2.5 pr-3 text-muted">
                      {line.party ? `${line.partyType ? line.partyType + " · " : ""}${line.party}` : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{line.debit > 0 ? formatCurrency(line.debit) : "—"}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{line.credit > 0 ? formatCurrency(line.credit) : "—"}</td>
                    <td className="py-2.5 text-muted">{[line.costCenter, line.project].filter(Boolean).join(" · ") || "—"}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2.5 pr-3 font-bold text-heading" colSpan={2}>Total</td>
                  <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-heading">{formatCurrency(expense.totalDebit)}</td>
                  <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-heading">{formatCurrency(expense.totalCredit)}</td>
                  <td className="py-2.5" />
                </tr>
              </tbody>
            </table>
          </div>
          {expense.company && (
            <p className="text-xs text-muted">Company: {expense.company}</p>
          )}
          <a
            href={`/reports/general-ledger?voucher_type=${encodeURIComponent(expense.voucherType)}&voucher_no=${encodeURIComponent(expense.name)}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            <FileText size={14} /> View in General Ledger
          </a>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted">Created</p>
          <p className="font-semibold text-heading">{expense.createdAt ? formatDate(expense.createdAt) : "—"}</p>
        </div>
        <div>
          <p className="text-muted">Modified</p>
          <p className="font-semibold text-heading">{expense.modified ? formatDate(expense.modified) : "—"}</p>
        </div>
      </div>
    </div>
  )
}