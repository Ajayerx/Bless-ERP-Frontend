import { Button } from "@/components/ui"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { BankTransaction } from "../types"

interface Props {
  rows: BankTransaction[]
  onAction: (transaction: BankTransaction) => void
  currency: string
  loading?: boolean
}

export default function BankTransactionsTable({ rows, onAction, currency, loading }: Props) {
  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead>
            <tr className="bg-gray-50/50">
              {[
                "Date",
                "Party Type",
                "Party",
                "Description",
                "Deposit",
                "Withdrawal",
                "Unallocated Amount",
                "Reference Number",
                "",
              ].map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  className={cnAlign(header)}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted">
                  No Matching Bank Transactions Found
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.name} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-body whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="px-4 py-3 text-body">{row.party_type}</td>
                  <td className="px-4 py-3 font-medium text-heading">{row.party}</td>
                  <td className="px-4 py-3 text-body max-w-xs truncate">{row.description}</td>
                  <td className="px-4 py-3 text-right text-success-600 whitespace-nowrap">
                    {row.deposit ? formatCurrency(row.deposit, currency) : ""}
                  </td>
                  <td className="px-4 py-3 text-right text-danger-600 whitespace-nowrap">
                    {row.withdrawal ? formatCurrency(row.withdrawal, currency) : ""}
                  </td>
                  <td className="px-4 py-3 text-right text-primary-600 whitespace-nowrap">
                    {formatCurrency(row.unallocated_amount, currency)}
                  </td>
                  <td className="px-4 py-3 text-body">{row.reference_number}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => onAction(row)}>
                      Actions
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function cnAlign(header: string): string {
  const right = header === "Deposit" || header === "Withdrawal" || header === "Unallocated Amount"
  return `px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider ${
    right ? "text-right" : "text-left"
  }`
}
