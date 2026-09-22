import { Checkbox } from "@/components/ui"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { ReconInvoiceRow } from "../../types"

interface Props {
  rows: ReconInvoiceRow[]
  selected: Set<string>
  onToggle: (key: string, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  currency: string
}

export default function ReconInvoiceTable({ rows, selected, onToggle, onToggleAll, currency }: Props) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.invoice_number))

  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-4 py-3 w-10">
                <Checkbox
                  aria-label="Select all invoices"
                  checked={allChecked}
                  onCheckedChange={(checked) => onToggleAll(checked === true)}
                />
              </th>
              {["Invoice Type", "Invoice Number", "Invoice Date", "Outstanding Amount"].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider ${
                    h === "Amount" || h === "Outstanding Amount" ? "text-right" : "text-left"
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
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  No Data
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.invoice_number} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Checkbox
                      aria-label={`Select ${row.invoice_number}`}
                      checked={selected.has(row.invoice_number)}
                      onCheckedChange={(checked) => onToggle(row.invoice_number, checked === true)}
                    />
                  </td>
                  <td className="px-4 py-3 text-body">{row.invoice_type}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-heading">{row.invoice_number}</span>
                  </td>
                  <td className="px-4 py-3 text-body">{formatDate(row.invoice_date)}</td>
                  <td className="px-4 py-3 text-right text-body">
                    {formatCurrency(row.outstanding_amount, currency)}
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