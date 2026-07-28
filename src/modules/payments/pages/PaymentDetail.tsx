"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Send, Trash2, XCircle, RotateCcw, Printer, Mail } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Badge, Skeleton } from "@/components/ui"
import { ConfirmationDialog } from "@/components/ui"
import { paymentService, type PaymentEntry } from "@/services"
import { ApiError } from "@/services/api-client"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

function Field({ label, value, currency }: { label: string; value: React.ReactNode; currency?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">{label}</label>
      <p className="text-sm text-body">{value ?? "—"}{currency && value ? <span className="text-xs text-muted ml-1">{currency}</span> : null}</p>
    </div>
  )
}

function statusBadge(docstatus: number, status: string) {
  if (docstatus === 1) return <Badge variant="success">Submitted</Badge>
  if (docstatus === 2) return <Badge variant="danger">Cancelled</Badge>
  return <Badge variant="warning">{status || "Draft"}</Badge>
}

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [payment, setPayment] = useState<PaymentEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"submit" | "cancel" | "delete" | "amend" | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const fetchPayment = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const p = await paymentService.getById(id)
      setPayment(p)
    } catch {
      setPayment(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchPayment() }, [fetchPayment])

  const handleConfirm = async () => {
    if (!payment || !confirmAction) return
    setActing(true)
    setConfirmError(null)
    try {
      if (confirmAction === "submit") {
        await paymentService.submitPayment(payment.name)
        await fetchPayment()
      } else if (confirmAction === "cancel") {
        await paymentService.cancelPayment(payment.name)
        await fetchPayment()
      } else if (confirmAction === "delete") {
        await paymentService.deletePayment(payment.name)
        navigate("/payments")
      } else if (confirmAction === "amend") {
        const original = await paymentService.getById(payment.name)
        navigate("/payments/new", { state: { amendFrom: original } })
      }
      setConfirmAction(null)
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : "Action failed. Please try again.")
    } finally {
      setActing(false)
    }
  }

  const confirmTitle = {
    submit: "Submit Payment",
    cancel: "Cancel Payment",
    delete: "Delete Payment",
    amend: "Amend Payment",
  }[confirmAction ?? ""]

  const confirmMessage = {
    submit: `Permanently submit ${payment?.name}? This action cannot be undone.`,
    cancel: `Permanently cancel ${payment?.name}? This will reverse all GL entries.`,
    delete: `Delete ${payment?.name}? This action cannot be undone.`,
    amend: `Create a new draft copy of ${payment?.name}?`,
  }[confirmAction ?? ""]

  if (loading) return <><Topbar /><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!payment) return <><Topbar /><div className="p-6 text-center text-muted">Payment not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <Link to="/payments" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors">
          <ArrowLeft size={15} /> Back to Payments
        </Link>

        <div className="bg-white rounded-2xl shadow-card p-6 space-y-6">
          {/* Header with status + actions */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-heading">{payment.name}</h1>
            {statusBadge(payment.docstatus, payment.status)}
          </div>

          {/* Action buttons — ERPNext flow */}
          <div className="flex items-center gap-2 flex-wrap">
            {payment.docstatus === 0 && (
              <>
                <button
                  onClick={() => setConfirmAction("submit")}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-primary-600 rounded-[10px] hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  <Send size={14} /> Submit
                </button>
                <button
                  onClick={() => setConfirmAction("delete")}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-danger-600 bg-danger-50 border border-danger-100 rounded-[10px] hover:bg-danger-100 disabled:opacity-50 transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}

            {payment.docstatus === 1 && (
              <>
                <button
                  onClick={() => setConfirmAction("cancel")}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-danger-600 bg-danger-50 border border-danger-100 rounded-[10px] hover:bg-danger-100 disabled:opacity-50 transition-colors"
                >
                  <XCircle size={14} /> Cancel
                </button>
                <button
                  onClick={() => window.open(`/printview?doctype=Payment Entry&name=${payment.name}`, "_blank")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-heading bg-surface border border-border rounded-[10px] hover:bg-gray-50 transition-colors"
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  onClick={() => {/* TODO: email dialog */}}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-heading bg-surface border border-border rounded-[10px] hover:bg-gray-50 transition-colors"
                >
                  <Mail size={14} /> Email
                </button>
              </>
            )}

            {payment.docstatus === 2 && (
              <>
                <button
                  onClick={() => setConfirmAction("amend")}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-heading bg-surface border border-border rounded-[10px] hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <RotateCcw size={14} /> Amend
                </button>
                <button
                  onClick={() => setConfirmAction("delete")}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-danger-600 bg-danger-50 border border-danger-100 rounded-[10px] hover:bg-danger-100 disabled:opacity-50 transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
          </div>

          {/* Core Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Payment Type" value={payment.payment_type} />
            <Field label="Posting Date" value={formatDate(payment.posting_date)} />
            <Field label="Company" value={payment.company} />
            <Field label="Mode of Payment" value={payment.mode_of_payment} />
          </div>

          {/* Party */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Party Type" value={payment.party_type} />
            <Field label="Party" value={payment.party_name || payment.party} />
            <Field label="Party Balance" value={payment.party_balance != null ? formatCurrency(payment.party_balance) : undefined} />
            <Field label="Contact Person" value={payment.contact_person} />
            {payment.contact_email && <Field label="Contact Email" value={payment.contact_email} />}
          </div>

          {/* Accounts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Paid From" value={payment.paid_from} />
            <Field label="Paid From Currency" value={payment.paid_from_account_currency} />
            <Field label="Paid From Balance" value={payment.paid_from_account_balance != null ? formatCurrency(payment.paid_from_account_balance, payment.paid_from_account_currency) : undefined} />
            <Field label="Paid To" value={payment.paid_to} />
            <Field label="Paid To Currency" value={payment.paid_to_account_currency} />
            <Field label="Paid To Balance" value={payment.paid_to_account_balance != null ? formatCurrency(payment.paid_to_account_balance, payment.paid_to_account_currency) : undefined} />
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Paid Amount" value={formatCurrency(payment.paid_amount, payment.paid_from_account_currency)} />
            <Field label="Received Amount" value={formatCurrency(payment.received_amount, payment.paid_to_account_currency)} />
            <Field label="Base Paid Amount" value={payment.base_paid_amount != null ? formatCurrency(payment.base_paid_amount) : undefined} />
            <Field label="Base Received Amount" value={payment.base_received_amount != null ? formatCurrency(payment.base_received_amount) : undefined} />
            <Field label="Source Exchange Rate" value={payment.source_exchange_rate ?? 1} />
            <Field label="Target Exchange Rate" value={payment.target_exchange_rate ?? 1} />
          </div>

          {/* Banking */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Bank Account" value={payment.bank_account} />
            <Field label="Bank" value={payment.bank} />
            <Field label="Party Bank Account" value={payment.party_bank_account} />
            <Field label="Reference No" value={payment.reference_no} />
            <Field label="Reference Date" value={payment.reference_date ? formatDate(payment.reference_date) : undefined} />
            <Field label="Clearance Date" value={payment.clearance_date ? formatDate(payment.clearance_date) : undefined} />
          </div>

          {payment.remarks && (
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Remarks</label>
              <p className="text-sm text-body whitespace-pre-wrap">{payment.remarks}</p>
            </div>
          )}

          {/* Deductions */}
          {payment.deductions && payment.deductions.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Deductions</label>
              <div className="space-y-1">
                {payment.deductions.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-[10px] px-4 py-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-heading">{d.account}</span>
                      {d.cost_center && <span className="text-xs text-muted">{d.cost_center}</span>}
                    </div>
                    {d.description && <span className="text-xs text-muted">{d.description}</span>}
                    <span className="font-semibold text-danger-600">{formatCurrency(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* References */}
          {payment.references && payment.references.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                References ({payment.references.length})
              </label>
              <div className="space-y-2">
                {payment.references.map((ref, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-[10px] px-4 py-2.5">
                    <div>
                      <span className="font-medium text-heading">{ref.reference_name}</span>
                      <span className="text-xs text-muted ml-2">{ref.reference_doctype}</span>
                      {ref.due_date && <span className="text-xs text-muted ml-2">Due {formatDate(ref.due_date)}</span>}
                    </div>
                    <div className="text-right">
                      <span className="text-muted text-xs mr-2">O/S {formatCurrency(ref.outstanding_amount)}</span>
                      <span className="font-semibold text-success-600">{formatCurrency(ref.allocated_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-border">
            <Field label="Total Allocated" value={formatCurrency(payment.total_allocated_amount ?? 0)} />
            <Field label="Unallocated" value={formatCurrency(payment.unallocated_amount ?? 0)} />
            <Field label="Difference" value={formatCurrency(payment.difference_amount ?? 0)} />
          </div>
        </div>
      </motion.div>

      {/* Confirmation dialog */}
      <ConfirmationDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null)
            setConfirmError(null)
          }
        }}
        onConfirm={handleConfirm}
        title={confirmTitle}
        description={confirmMessage}
        confirmLabel={confirmAction === "delete" ? "Delete" : confirmAction === "submit" ? "Submit" : confirmAction === "cancel" ? "Cancel" : "Amend"}
        variant={confirmAction === "delete" || confirmAction === "cancel" ? "danger" : "warning"}
        loading={acting}
        error={confirmError}
      />
    </>
  )
}
