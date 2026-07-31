"use client"

import { useState, useEffect } from "react"
import { Loader2, DollarSign } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui"
import { Button } from "@/components/ui"
import { paymentService, type SalesInvoice } from "@/services"
import { formatCurrency } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: SalesInvoice
  onPaymentComplete: () => void
}

export default function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  onPaymentComplete,
}: Props) {
  const [amount, setAmount] = useState(invoice.outstanding_amount ?? invoice.grand_total)
  const [postingDate, setPostingDate] = useState(new Date().toISOString().split("T")[0])
  const [modeOfPayment, setModeOfPayment] = useState("")
  const [mopOptions, setMopOptions] = useState<string[]>([])
  const [mopLoading, setMopLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setAmount(invoice.outstanding_amount ?? invoice.grand_total)
      setPostingDate(new Date().toISOString().split("T")[0])
      setModeOfPayment("")
      setSent(false)
      setError("")
      setMopLoading(true)
      paymentService.getModeOfPaymentList()
        .then(setMopOptions)
        .catch(() => setMopOptions([]))
        .finally(() => setMopLoading(false))
    }
  }, [open, invoice.name])

  const handleSubmit = async () => {
    if (amount <= 0) {
      setError("Amount must be greater than 0")
      return
    }
    if (!modeOfPayment) {
      setError("Mode of Payment is required")
      return
    }

    setSending(true)
    setError("")

    try {
      const defaultAccount = await paymentService.getModeOfPaymentAccount(modeOfPayment, invoice.company)

      if (!defaultAccount) {
        setError(`No default account found for Mode of Payment "${modeOfPayment}"`)
        setSending(false)
        return
      }

      const doc = await paymentService.saveDraft({
        payment_type: "Receive",
        party_type: "Customer",
        party: invoice.customer,
        posting_date: postingDate,
        company: invoice.company,
        mode_of_payment: modeOfPayment,
        paid_from: invoice.debit_to || "Debtors",
        paid_from_account_currency: invoice.currency,
        paid_to: defaultAccount,
        paid_to_account_currency: invoice.currency,
        paid_amount: amount,
        received_amount: amount,
        source_exchange_rate: 1,
        target_exchange_rate: 1,
        base_paid_amount: amount,
        base_received_amount: amount,
        references: [{
          reference_doctype: "Sales Invoice",
          reference_name: invoice.name,
          total_amount: invoice.grand_total,
          outstanding_amount: invoice.outstanding_amount,
          allocated_amount: amount,
          due_date: invoice.due_date,
        }],
      })

      await paymentService.submitPayment(doc.name)
      setSent(true)
      setTimeout(() => {
        onOpenChange(false)
        onPaymentComplete()
      }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record payment")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment for {invoice.name}</DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-green-600">Payment recorded successfully!</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="bg-gray-50 rounded-[10px] p-4 space-y-2 border border-border/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Customer</span>
                <span className="font-semibold text-heading">{invoice.customer_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Outstanding</span>
                <span className="font-semibold text-heading">{formatCurrency(invoice.outstanding_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Grand Total</span>
                <span className="font-semibold text-heading">{formatCurrency(invoice.grand_total)}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-heading block mb-1.5">Posting Date</label>
              <input
                type="date"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[10px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-heading block mb-1.5">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={invoice.outstanding_amount}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[10px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-heading block mb-1.5">Mode of Payment</label>
              <select
                value={modeOfPayment}
                onChange={(e) => setModeOfPayment(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[10px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={mopLoading}
              >
                <option value="">{mopLoading ? "Loading..." : "Select Mode of Payment"}</option>
                {mopOptions.map((mop) => (
                  <option key={mop} value={mop}>{mop}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-xs text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[8px]">
                {error}
              </p>
            )}
          </div>
        )}

        {!sent && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={sending || !amount || !modeOfPayment}>
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <DollarSign size={14} />
              )}
              {sending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
