import { Checkbox } from "@/components/ui"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { ReconPaymentRow } from "../../types"

interface Props {
  rows: ReconPaymentRow[]
  selected: Set<string>
  onToggle: (key: string, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  currency: string
}

export default function ReconPaymentTable({ rows, selected, onToggle, onToggleAll, currency }: Props) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.reference_name))

  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-4 py-3 w-10">
                <Checkbox
                  aria-label="Select all payments"
                  checked={allChecked}
                  onCheckedChange={(checked) => onToggleAll(checked === true)}
                />
              </th>
              {["Reference Name", "Posting Date", "Amount"].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap ${
                    h === "Amount" ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
                  No Data
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.reference_name} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Checkbox
                      aria-label={`Select ${row.reference_name}`}
                      checked={selected.has(row.reference_name)}
                      onCheckedChange={(checked) => onToggle(row.reference_name, checked === true)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-heading">{row.reference_name}</span>
                  </td>
                  <td className="px-4 py-3 text-body">{formatDate(row.posting_date)}</td>
                  <td className="px-4 py-3 text-right text-body">{formatCurrency(row.amount, currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
