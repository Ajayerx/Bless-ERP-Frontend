"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, BookOpen } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Badge, Skeleton, Modal } from "@/components/ui"
import { ConfirmationDialog } from "@/components/ui"
import { paymentService, type PaymentEntry, type LedgerPreviewData } from "@/services"
import { ApiError } from "@/services/api-client"
import PaymentForm, { type PaymentToolbarAction } from "../components/PaymentForm"

function statusBadge(docstatus: number, status: string) {
  if (docstatus === 1) return <Badge variant="success">Submitted</Badge>
  if (docstatus === 2) return <Badge variant="danger">Cancelled</Badge>
  return <Badge variant="warning">{status || "Draft"}</Badge>
}

function formatNumber(v: unknown): string {
  const n = Number(v)
  if (!isFinite(n)) return String(v ?? "—")
  return new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [payment, setPayment] = useState<PaymentEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"submit" | "cancel" | "delete" | "amend" | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerError, setLedgerError] = useState<string | null>(null)
  const [ledgerData, setLedgerData] = useState<LedgerPreviewData | null>(null)

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

  const handleToolbarAction = (action: PaymentToolbarAction) => {
    if (!payment) return
    if (action === "submit") setConfirmAction("submit")
    else if (action === "cancel") setConfirmAction("cancel")
    else if (action === "delete") setConfirmAction("delete")
    else if (action === "amend") setConfirmAction("amend")
    else if (action === "print") {
      window.open(`/printview?doctype=Payment Entry&name=${payment.name}`, "_blank")
    } else if (action === "email") {
      // TODO: email dialog
    }
  }

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

  const openLedgerPreview = async () => {
    if (!payment) return
    setLedgerOpen(true)
    setLedgerLoading(true)
    setLedgerError(null)
    setLedgerData(null)
    try {
      const data = await paymentService.getAccountingLedgerPreview(payment.company, payment.name)
      setLedgerData(data)
    } catch (err) {
      setLedgerError(err instanceof ApiError ? err.message : "Failed to load ledger preview.")
    } finally {
      setLedgerLoading(false)
    }
  }

  const confirmTitle = confirmAction
    ? {
        submit: "Submit Payment",
        cancel: "Cancel Payment",
        delete: "Delete Payment",
        amend: "Amend Payment",
      }[confirmAction]
    : undefined

  const confirmMessage = confirmAction
    ? {
        submit: `Permanently submit ${payment?.name}? This action cannot be undone.`,
        cancel: `Permanently cancel ${payment?.name}? This will reverse all GL entries.`,
        delete: `Delete ${payment?.name}? This action cannot be undone.`,
        amend: `Create a new draft copy of ${payment?.name}?`,
      }[confirmAction]
    : undefined

  if (loading) return <><Topbar /><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!payment) return <><Topbar /><div className="p-6 text-center text-muted">Payment not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <Link to="/payments" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors">
            <ArrowLeft size={15} /> Back to Payments
          </Link>
          <button
            type="button"
            onClick={openLedgerPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-heading bg-surface border border-border rounded-[10px] hover:bg-gray-50 transition-colors"
          >
            <BookOpen size={14} /> Accounting Ledger Preview
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-6 space-y-6">
          {/* Header with status */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-heading">{payment.name}</h1>
            {statusBadge(payment.docstatus, payment.status)}
          </div>

          {/* ERPNext form (editable per docstatus) */}
          <PaymentForm
            mode="existing"
            initialValues={payment}
            onSaved={() => fetchPayment()}
            onCancel={() => navigate("/payments")}
            onToolbarAction={handleToolbarAction}
          />
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
        title={confirmTitle ?? ""}
        description={confirmMessage ?? ""}
        confirmLabel={confirmAction === "delete" ? "Delete" : confirmAction === "submit" ? "Submit" : confirmAction === "cancel" ? "Cancel" : "Amend"}
        variant={confirmAction === "delete" || confirmAction === "cancel" ? "danger" : "warning"}
        loading={acting}
        error={confirmError}
      />

      {/* Accounting Ledger Preview dialog */}
      <Modal
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        title={`Accounting Ledger — ${payment.name}`}
        description={payment.company}
        size="xl"
      >
        {ledgerLoading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {ledgerError && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
            {ledgerError}
          </p>
        )}
        {!ledgerLoading && !ledgerError && ledgerData && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {ledgerData.gl_columns.map((col) => (
                    <th key={col.fieldname} className="text-left py-2 px-2 text-xs font-semibold text-muted whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledgerData.gl_data.length === 0 && (
                  <tr>
                    <td colSpan={ledgerData.gl_columns.length} className="py-4 text-center text-xs text-muted">
                      No ledger entries found.
                    </td>
                  </tr>
                )}
                {ledgerData.gl_data.map((row, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {ledgerData.gl_columns.map((col) => (
                      <td key={col.fieldname} className="py-2 px-2 text-xs text-body whitespace-nowrap tabular-nums">
                        {formatNumber(row[col.fieldname])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  )
}
