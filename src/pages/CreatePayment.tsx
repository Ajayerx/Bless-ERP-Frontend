"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui"
import { paymentService, type Invoice } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

const paymentMethods = [
  { value: "check", label: "Check" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "cash", label: "Cash" },
] as const

export default function CreatePayment() {
  const navigate = useNavigate()
  const [unpaid, setUnpaid] = useState<Invoice[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [amount, setAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]["value"]>("bank_transfer")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    paymentService.getUnpaidInvoices()
      .then(setUnpaid)
      .finally(() => setLoading(false))
  }, [])

  const selectedInvoice = unpaid.find((inv) => inv.id === selectedId)

  const handleSelectInvoice = (id: string) => {
    setSelectedId(id)
    const inv = unpaid.find((i) => i.id === id)
    if (inv) setAmount(inv.total)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!selectedInvoice) { setError("Please select an invoice."); return }
    if (amount <= 0) { setError("Amount must be greater than zero."); return }
    if (amount > selectedInvoice.total) { setError("Amount cannot exceed invoice total."); return }
    setSaving(true)
    try {
      await paymentService.record({
        invoiceId: selectedInvoice.id,
        invoiceNumber: selectedInvoice.number,
        customerName: selectedInvoice.customerName,
        amount, paymentDate, paymentMethod, reference, notes,
      })
      navigate("/payments")
    } catch {
      setError("Failed to record payment.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
  const labelClass = "block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5"

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6 max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/payments")}
            className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-heading">Record Payment</h1>
            <p className="text-sm text-muted mt-0.5">Record a payment against an invoice.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Select Invoice */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted">Loading unpaid invoices...</p>
              ) : unpaid.length === 0 ? (
                <p className="text-sm text-muted">No unpaid invoices available.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {unpaid.map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => handleSelectInvoice(inv.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-[12px] border transition-colors text-sm",
                        selectedId === inv.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-border hover:bg-gray-50"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-heading">{inv.number}</p>
                          <p className="text-xs text-muted">{inv.customerName} &middot; Due {formatDate(inv.dueDate)}</p>
                        </div>
                        <span className="font-semibold tabular-nums text-heading">{formatCurrency(inv.total)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedInvoice && (
            <>
              {/* Amount + Date + Method */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                    <input type="number" min={0.01} step={0.01} value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Payment Date</label>
                  <input type="date" value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Method</label>
                  <select value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as (typeof paymentMethods)[number]["value"])}
                    className={inputClass}>
                    {paymentMethods.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference + Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Reference #</label>
                  <input type="text" value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className={inputClass}
                    placeholder="Check number, wire ref, etc." />
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <input type="text" value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputClass}
                    placeholder="Optional notes..." />
                </div>
              </div>

              {error && (
                <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[10px]">{error}</p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={saving} loading={saving}>
                  <Save size={16} />
                  {saving ? "Recording..." : "Record Payment"}
                </Button>
                <Button variant="secondary" type="button" onClick={() => navigate("/payments")}>Cancel</Button>
              </div>
            </>
          )}
        </form>
      </motion.div>
    </>
  )
}
