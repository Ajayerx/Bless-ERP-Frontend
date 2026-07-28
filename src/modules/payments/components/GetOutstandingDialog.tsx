import { useState } from "react"
import { Search, Loader2 } from "lucide-react"
import Modal from "@/components/ui/Modal"
import { cn } from "@/lib/utils"

interface FilterValues {
  from_posting_date: string
  to_posting_date: string
  from_due_date: string
  to_due_date: string
  outstanding_amt_greater_than: number
  outstanding_amt_less_than: number
  allocate_payment_amount: boolean
}

interface GetOutstandingDialogProps {
  open: boolean
  onClose: () => void
  onFetch: (filters: FilterValues) => Promise<void>
  loading: boolean
  title: string
}

function getDefaultFromDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

const inputClass =
  "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"

export default function GetOutstandingDialog({
  open,
  onClose,
  onFetch,
  loading,
  title,
}: GetOutstandingDialogProps) {
  const [filters, setFilters] = useState<FilterValues>({
    from_posting_date: getDefaultFromDate(),
    to_posting_date: getToday(),
    from_due_date: "",
    to_due_date: "",
    outstanding_amt_greater_than: 0,
    outstanding_amt_less_than: 0,
    allocate_payment_amount: true,
  })

  const update = (field: keyof FilterValues, value: string | number | boolean) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleFetch = async () => {
    await onFetch(filters)
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        {/* Posting Date Range */}
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Posting Date</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">From Date</label>
              <input
                type="date"
                value={filters.from_posting_date}
                onChange={(e) => update("from_posting_date", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">To Date</label>
              <input
                type="date"
                value={filters.to_posting_date}
                onChange={(e) => update("to_posting_date", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Due Date Range */}
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Due Date</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">From Date</label>
              <input
                type="date"
                value={filters.from_due_date}
                onChange={(e) => update("from_due_date", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">To Date</label>
              <input
                type="date"
                value={filters.to_due_date}
                onChange={(e) => update("to_due_date", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Outstanding Amount */}
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Outstanding Amount</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Greater Than</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={filters.outstanding_amt_greater_than}
                onChange={(e) => update("outstanding_amt_greater_than", parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Less Than</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={filters.outstanding_amt_less_than || ""}
                onChange={(e) => update("outstanding_amt_less_than", parseFloat(e.target.value) || 0)}
                className={inputClass}
                placeholder="No limit"
              />
            </div>
          </div>
        </div>

        {/* Allocate checkbox */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.allocate_payment_amount}
            onChange={(e) => update("allocate_payment_amount", e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-body font-medium">Allocate Payment Amount</span>
        </label>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleFetch}
          disabled={loading}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-[12px] transition-all duration-200 shadow-sm",
            "bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? "Fetching..." : "Get Outstanding"}
        </button>
      </div>
    </Modal>
  )
}
