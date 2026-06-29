import { useState } from "react"
import { Save } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Button,
} from "@/components/ui"
import { paymentService, type Invoice } from "@/services"
import { formatCurrency } from "@/lib/utils"

const paymentMethods = [
  { value: "check", label: "Check" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "cash", label: "Cash" },
] as const

interface RecordPaymentModalProps {
  open: boolean
  onClose: () => void
  invoice: Invoice
  onRecorded: () => void
}

export default function RecordPaymentModal({
  open,
  onClose,
  invoice,
  onRecorded,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState(invoice.total)
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof paymentMethods)[number]["value"]>("bank_transfer")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (amount <= 0) {
      setError("Payment amount must be greater than zero.")
      return
    }
    if (amount > invoice.total) {
      setError("Amount cannot exceed the invoice total.")
      return
    }
    setSaving(true)
    try {
      await paymentService.record({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        customerName: invoice.customerName,
        amount,
        paymentDate,
        paymentMethod,
        reference,
        notes,
      })
      onRecorded()
    } catch {
      setError("Failed to record payment. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for invoice {invoice.number}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Invoice info */}
          <div className="bg-primary-50 rounded-[14px] px-4 py-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Invoice</span>
              <span className="font-semibold text-heading">{invoice.number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Customer</span>
              <span className="font-semibold text-heading">{invoice.customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Amount Due</span>
              <span className="font-semibold text-heading tabular-nums">{formatCurrency(invoice.total)}</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[10px]">
              {error}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Payment Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 pr-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                Payment Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(
                    e.target.value as (typeof paymentMethods)[number]["value"]
                  )
                }
                className="w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              >
                {paymentMethods.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Reference #
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              placeholder="Check number, wire ref, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
              placeholder="Optional notes..."
            />
          </div>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} loading={saving}>
              <Save size={16} />
              {saving ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
