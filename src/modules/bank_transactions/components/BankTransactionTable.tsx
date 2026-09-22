import { Badge } from "@/components/ui"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { BankTransactionDoc } from "../types"
import { statusIndicator } from "../types"

interface Props {
  rows: BankTransactionDoc[]
  loading?: boolean
  currency?: string
  onRowClick: (doc: BankTransactionDoc) => void
}

function alignClass(header: string): string {
  const right = header === "Deposit" || header === "Withdrawal" || header === "Unallocated Amount"
  return `px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider ${
    right ? "text-right" : "text-left"
  }`
}

export default function BankTransactionTable({ rows, loading, currency = "CAD", onRowClick }: Props) {
  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead>
            <tr className="bg-gray-50/50">
              {[
                "Date",
                "Description",
                "Bank Account",
                "Deposit",
                "Withdrawal",
                "Unallocated Amount",
                "Status",
              ].map((header) => (
                <th key={header} className={alignClass(header)}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                  No Bank Transactions Found
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const indicator = statusIndicator(row)
                return (
                  <tr
                    key={row.name}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => onRowClick(row)}
                  >
                    <td className="px-4 py-3 text-body whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="px-4 py-3 text-body max-w-xs truncate">{row.description}</td>
                    <td className="px-4 py-3 text-body">{row.bank_account}</td>
                    <td className="px-4 py-3 text-right text-success-600 whitespace-nowrap">
                      {row.deposit ? formatCurrency(row.deposit, currency) : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-danger-600 whitespace-nowrap">
                      {row.withdrawal ? formatCurrency(row.withdrawal, currency) : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-primary-600 whitespace-nowrap">
                      {formatCurrency(row.unallocated_amount, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={indicator.tone}>{indicator.label}</Badge>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
