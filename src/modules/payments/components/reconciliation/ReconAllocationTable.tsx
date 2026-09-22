import { formatCurrency } from "@/lib/utils"
import type { ReconAllocationRow } from "../../types"

interface Props {
  rows: ReconAllocationRow[]
  onChange: (index: number, patch: Partial<ReconAllocationRow>) => void
  currency: string
}

const cellInputClass =
  "w-28 px-2 py-1 bg-surface border border-border rounded-lg text-sm text-right text-body " +
  "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"

export default function ReconAllocationTable({ rows, onChange, currency }: Props) {
  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead>
            <tr className="bg-gray-50/50">
              {["No.", "Reference Name", "Invoice Number", "Allocated Amount", "Difference Amount"].map(
                (h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap ${
                      h.includes("Amount") ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  No allocations yet. Select payments and invoices, then click "Allocate".
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.reference_name}-${row.invoice_number}-${index}`} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-body text-center">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-heading whitespace-nowrap">{row.reference_name}</td>
                  <td className="px-4 py-3 text-body whitespace-nowrap">{row.invoice_number}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      aria-label={`Allocated amount for ${row.invoice_number}`}
                      className={cellInputClass}
                      value={String(row.allocated_amount)}
                      onChange={(e) => onChange(index, { allocated_amount: Number(e.target.value || 0) })}
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-body whitespace-nowrap">
                    {formatCurrency(row.difference_amount, currency)}
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
