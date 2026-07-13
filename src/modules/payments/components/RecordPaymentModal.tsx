import { useState, useEffect, useCallback } from "react"
import { Save, Loader2, Search, ChevronDown, Plus, Trash2 } from "lucide-react"
import Modal from "@/components/ui/Modal"
import { paymentService, type SalesInvoice } from "@/services"
import { cn } from "@/lib/utils"
import PaymentMethodSelect, { type PaymentMethodValue } from "./PaymentMethodSelect"
import type { InvoiceAllocation, PaymentDeductionForm } from "../types"

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(n)
}

interface RecordPaymentModalProps {
  open: boolean
  onClose: () => void
  invoice: SalesInvoice | null
  onRecorded: () => void
}

type PaymentType = "Receive" | "Pay" | "Internal Transfer"

function createDeduction(): PaymentDeductionForm {
  return { id: crypto.randomUUID(), account: "", amount: 0, description: "" }
}

export default function RecordPaymentModal({
  open,
  onClose,
  invoice,
  onRecorded,
}: RecordPaymentModalProps) {
  const [paymentType, setPaymentType] = useState<PaymentType>("Receive")

  const [unpaidInvoices, setUnpaidInvoices] = useState<SalesInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [invoiceSearch, setInvoiceSearch] = useState("")
  const [invoiceDropdownOpen, setInvoiceDropdownOpen] = useState(false)

  const [allocations, setAllocations] = useState<InvoiceAllocation[]>([])
  const [bankOptions, setBankOptions] = useState<Array<{ name: string; label?: string }>>([])
  const [contactOptions, setContactOptions] = useState<Array<{ name: string; label?: string }>>([])

  const [amount, setAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("bank_transfer")
  const [bankAccount, setBankAccount] = useState("")
  const [partyBankAccount, setPartyBankAccount] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [deductions, setDeductions] = useState<PaymentDeductionForm[]>([])
  const [showDeductions, setShowDeductions] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const partyName = invoice?.customer_name ?? ""

  const fetchUnpaidInvoices = useCallback(async () => {
    setLoadingInvoices(true)
    try {
      const partyFilter = paymentType === "Receive" && invoice
        ? [["customer", "=", invoice.customer]]
        : undefined
      const result = await paymentService.getUnpaidInvoices(partyFilter)
      setUnpaidInvoices(result)
    } finally {
      setLoadingInvoices(false)
    }
  }, [paymentType, invoice])

  const fetchOptions = useCallback(async () => {
    try {
      const [banks] = await Promise.all([
        paymentService.fetchOptions("Bank Account", "bank_name"),
      ])
      setBankOptions(banks)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchUnpaidInvoices()
      fetchOptions()
    }
  }, [open, fetchUnpaidInvoices, fetchOptions])

  useEffect(() => {
    if (invoice) {
      setAllocations([{
        name: invoice.name,
        customer_name: invoice.customer_name,
        grand_total: invoice.grand_total,
        outstanding_amount: invoice.outstanding_amount,
        allocated_amount: invoice.outstanding_amount,
      }])
      setAmount(invoice.outstanding_amount)
    } else {
      setAllocations([])
      setAmount(0)
    }
    setPaymentType("Receive")
    setBankAccount("")
    setPartyBankAccount("")
    setContactPerson("")
    setReference("")
    setNotes("")
    setDeductions([])
    setShowDeductions(false)
    setError("")
  }, [invoice, open])

  const filteredInvoices = unpaidInvoices.filter(
    (inv) =>
      inv.name.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(invoiceSearch.toLowerCase()),
  )

  const selectInvoice = (inv: SalesInvoice) => {
    const exists = allocations.find((a) => a.name === inv.name)
    if (exists) {
      setAllocations((prev) =>
        prev.map((a) => a.name === inv.name ? { ...a, allocated_amount: a.outstanding_amount } : a)
      )
    } else {
      setAllocations((prev) => [...prev, {
        name: inv.name,
        customer_name: inv.customer_name,
        grand_total: inv.grand_total,
        outstanding_amount: inv.outstanding_amount,
        allocated_amount: inv.outstanding_amount,
      }])
    }
    setInvoiceSearch("")
    setInvoiceDropdownOpen(false)
  }

  const updateAllocation = (invoiceName: string, allocatedAmount: number) => {
    setAllocations((prev) =>
      prev.map((a) =>
        a.name === invoiceName
          ? { ...a, allocated_amount: Math.min(allocatedAmount, a.outstanding_amount) }
          : a
      )
    )
  }

  const removeAllocation = (invoiceName: string) => {
    setAllocations((prev) => prev.filter((a) => a.name !== invoiceName))
  }

  const totalAllocated = allocations.reduce((s, a) => s + a.allocated_amount, 0)

  useEffect(() => {
    if (allocations.length > 0) {
      setAmount(totalAllocated)
    }
  }, [totalAllocated, allocations.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (paymentType !== "Internal Transfer" && allocations.length === 0) {
      setError("Please select at least one invoice to allocate payment.")
      return
    }
    if (amount <= 0) {
      setError("Payment amount must be greater than zero.")
      return
    }
    if (paymentType === "Internal Transfer" && !bankAccount) {
      setError("Please select a bank account for internal transfer.")
      return
    }

    setSaving(true)
    try {
      await paymentService.record({
        paymentType,
        partyType: paymentType === "Pay" ? "Supplier" : "Customer",
        party: invoice?.customer || partyName || "",
        partyName,
        amount,
        paymentDate,
        paymentMethod,
        reference,
        notes,
        bankAccount: bankAccount || undefined,
        partyBankAccount: partyBankAccount || undefined,
        contactPerson: contactPerson || undefined,
        allocations: paymentType !== "Internal Transfer" ? allocations : [],
        deductions: deductions.filter((d) => d.account && d.amount > 0),
      })
      onRecorded()
    } catch {
      setError("Failed to record payment. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"

  return (
    <Modal open={open} onClose={onClose} title="Record Payment" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Payment Type */}
        <div>
          <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Payment Type *
          </label>
          <select
            value={paymentType}
            onChange={(e) => {
              setPaymentType(e.target.value as PaymentType)
              setAllocations([])
              setAmount(0)
              setError("")
            }}
            className={inputClass}
          >
            <option value="Receive">Receive (Customer Payment)</option>
            <option value="Pay">Pay (Supplier Payment)</option>
            <option value="Internal Transfer">Internal Transfer (Bank to Bank)</option>
          </select>
        </div>

        {/* Invoice Allocation — for Receive/Pay */}
        {paymentType !== "Internal Transfer" && (
          <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                Invoice Allocation
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchUnpaidInvoices}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Invoice selector */}
            <div className="relative">
              <input
                type="text"
                value={invoiceSearch}
                onChange={(e) => {
                  setInvoiceSearch(e.target.value)
                  setInvoiceDropdownOpen(true)
                }}
                onFocus={() => setInvoiceDropdownOpen(true)}
                placeholder="Search and select invoices..."
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
              {invoiceDropdownOpen && (
                <div className="absolute z-10 mt-1.5 w-full bg-surface border border-border rounded-[14px] shadow-xl max-h-48 overflow-y-auto">
                  {loadingInvoices ? (
                    <p className="px-4 py-3 text-sm text-muted">Loading...</p>
                  ) : filteredInvoices.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted">No unpaid invoices found</p>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <button
                        key={inv.name}
                        type="button"
                        onClick={() => selectInvoice(inv)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm transition-colors",
                          allocations.some((a) => a.name === inv.name)
                            ? "bg-primary-50 text-primary-700 font-semibold"
                            : "text-body hover:bg-gray-50",
                        )}
                      >
                        <span className="font-medium">{inv.name}</span>
                        <span className="text-xs text-muted ml-2">{inv.customer_name}</span>
                        <span className="float-right font-semibold tabular-nums">
                          {formatCurrency(inv.outstanding_amount)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected invoices — allocation table */}
            {allocations.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-1.5 text-xs font-semibold text-muted">Invoice</th>
                      <th className="text-right py-1.5 text-xs font-semibold text-muted">Outstanding</th>
                      <th className="text-right py-1.5 text-xs font-semibold text-muted w-[120px]">Allocation</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a) => (
                      <tr key={a.name} className="border-b border-border/30">
                        <td className="py-1.5">
                          <span className="font-medium text-heading">{a.name}</span>
                        </td>
                        <td className="py-1.5 text-right text-muted tabular-nums">
                          {formatCurrency(a.outstanding_amount)}
                        </td>
                        <td className="py-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            max={a.outstanding_amount}
                            step={0.01}
                            value={a.allocated_amount}
                            onChange={(e) => updateAllocation(a.name, parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 text-sm text-right border border-border rounded-[8px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                          />
                        </td>
                        <td className="py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => removeAllocation(a.name)}
                            className="p-1 text-muted hover:text-danger-600 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-between items-center pt-2 text-sm">
                  <span className="font-semibold text-muted">Total Allocated</span>
                  <span className="font-bold text-heading tabular-nums">{formatCurrency(totalAllocated)}</span>
                </div>
              </div>
            )}

            {/* Invoice info when preselected */}
            {invoice && allocations.length === 1 && (
              <div className="bg-surface rounded-[12px] px-4 py-3 space-y-1 border border-border/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Customer</span>
                  <span className="font-semibold text-heading">{invoice.customer_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Amount Due</span>
                  <span className="font-bold text-heading">{formatCurrency(invoice.outstanding_amount)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
            {error}
          </p>
        )}

        {/* Payment Amount */}
        <div>
          <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Payment Amount *
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
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

        {/* Date + Method + Bank Account */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Method</label>
            <PaymentMethodSelect
              value={paymentMethod}
              onChange={(v) => setPaymentMethod(v as PaymentMethodValue)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Bank Account</label>
            <select
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              className={inputClass}
            >
              <option value="">{paymentType === "Internal Transfer" ? "Select source bank *" : "Default (Cash - BE)"}</option>
              {bankOptions.map((b) => (
                <option key={b.name} value={b.name}>{b.label || b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Party Bank Account</label>
            <input
              type="text"
              value={partyBankAccount}
              onChange={(e) => setPartyBankAccount(e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Contact Person</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Reference #</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={inputClass}
              placeholder="Check no, wire ref, etc."
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Optional notes..."
          />
        </div>

        {/* Deductions */}
        <div>
          <button
            type="button"
            onClick={() => setShowDeductions(!showDeductions)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider hover:text-body transition-colors"
          >
            <ChevronDown size={12} className={cn("transition-transform", showDeductions && "rotate-180")} />
            Deductions
            {deductions.length > 0 && <span className="text-primary-600">({deductions.length})</span>}
          </button>
          {showDeductions && (
            <div className="mt-2 space-y-2">
              {deductions.map((d, i) => (
                <div key={d.id} className="grid grid-cols-[1fr_100px_1fr_auto] gap-2 items-start">
                  <input
                    type="text"
                    value={d.account}
                    onChange={(e) => {
                      const next = [...deductions]
                      next[i] = { ...next[i], account: e.target.value }
                      setDeductions(next)
                    }}
                    placeholder="Account"
                    className={inputClass}
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={d.amount}
                    onChange={(e) => {
                      const next = [...deductions]
                      next[i] = { ...next[i], amount: parseFloat(e.target.value) || 0 }
                      setDeductions(next)
                    }}
                    placeholder="Amount"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={d.description}
                    onChange={(e) => {
                      const next = [...deductions]
                      next[i] = { ...next[i], description: e.target.value }
                      setDeductions(next)
                    }}
                    placeholder="Description"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setDeductions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-2 text-muted hover:text-danger-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDeductions((prev) => [...prev, createDeduction()])}
                className="flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
              >
                <Plus size={14} /> Add Deduction
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Recording..." : "Record Payment"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
