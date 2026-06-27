import { useState } from "react"
import { Save, Loader2 } from "lucide-react"
import Modal from "../../components/ui/Modal"
import { paymentService, type Invoice } from "../../services"

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n)
}

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

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors"

  return (
    <Modal open={open} onClose={onClose} title="Record Payment" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Invoice info */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Invoice</span>
            <span className="font-medium text-gray-900">{invoice.number}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Customer</span>
            <span className="font-medium text-gray-900">
              {invoice.customerName}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Amount Due</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(invoice.total)}
            </span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Amount *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              $
            </span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className={`${inputClass} pl-7`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value as (typeof paymentMethods)[number]["value"]
                )
              }
              className={inputClass}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reference #
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={inputClass}
            placeholder="Check number, wire ref, etc."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {saving ? "Recording..." : "Record Payment"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
