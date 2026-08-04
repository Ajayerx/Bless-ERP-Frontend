"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { BookOpen, Check, Save, Ban, GitBranch, Copy, Mail, Printer, Trash2, MoreHorizontal } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import PageHead from "@/components/layout/PageHead"
import { Badge, Button, Skeleton, Modal } from "@/components/ui"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui"
import { ConfirmationDialog } from "@/components/ui"
import { paymentService, type PaymentEntry, type LedgerPreviewData, type PaymentComment } from "@/services"
import { ApiError } from "@/services/api-client"
import PaymentForm, { type PaymentFormHandle } from "../components/PaymentForm"
import { normalizeLedger } from "../components/ledgerUtils"
import SendPaymentEmailDialog from "../components/SendPaymentEmailDialog"

function statusBadge(docstatus: number, status: string) {
  if (docstatus === 1) return <Badge variant="success">Submitted</Badge>
  if (docstatus === 2) return <Badge variant="danger">Cancelled</Badge>
  return <Badge variant="warning">{status || "Draft"}</Badge>
}

function formatNumber(v: unknown): string {
  const n = Number(v)
  if (!isFinite(n)) return String(v ?? "\u2014")
  return new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return iso
  }
}

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const formRef = useRef<PaymentFormHandle>(null)
  const [payment, setPayment] = useState<PaymentEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"submit" | "cancel" | "delete" | "amend" | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerError, setLedgerError] = useState<string | null>(null)
  const [ledgerData, setLedgerData] = useState<LedgerPreviewData | null>(null)
  const [comments, setComments] = useState<PaymentComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

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

  const loadLedger = useCallback(async (company: string, name: string) => {
    setLedgerLoading(true)
    setLedgerError(null)
    try {
      const data = await paymentService.getAccountingLedgerPreview(company, name)
      setLedgerData(data)
    } catch (err) {
      setLedgerError(err instanceof ApiError ? err.message : "Failed to load ledger preview.")
    } finally {
      setLedgerLoading(false)
    }
  }, [])

  const loadComments = useCallback(async (name: string) => {
    setCommentsLoading(true)
    try {
      setComments(await paymentService.getComments(name))
    } catch {
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!payment) return
    loadComments(payment.name)
    loadLedger(payment.company, payment.name)
  }, [payment, loadComments, loadLedger])

  const handleConfirm = async () => {
    if (!payment || !confirmAction) return
    setActing(true)
    setConfirmError(null)
    try {
      if (confirmAction === "submit") {
        const savedName = await formRef.current?.save()
        if (!savedName) { setActing(false); return }
        await paymentService.submitPayment(savedName)
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

  const handleSave = async () => {
    await formRef.current?.save()
  }

  const openLedgerPreview = async () => {
    if (!payment) return
    setLedgerOpen(true)
    await loadLedger(payment.company, payment.name)
  }

  const handleAddComment = async (content: string) => {
    if (!payment) return
    const created = await paymentService.addComment(payment.name, content)
    setComments((prev) => [created, ...prev])
  }

  const confirmTitle = confirmAction
    ? ({
        submit: "Submit Payment",
        cancel: "Cancel Payment",
        delete: "Delete Payment",
        amend: "Amend Payment",
      }[confirmAction])
    : undefined

  const confirmMessage = confirmAction
    ? ({
        submit: `Permanently submit ${payment?.name}? This action cannot be undone.`,
        cancel: `Permanently cancel ${payment?.name}? This will reverse all GL entries.`,
        delete: `Delete ${payment?.name}? This action cannot be undone.`,
        amend: `Create a new draft copy of ${payment?.name}?`,
      }[confirmAction])
    : undefined

  if (loading) return <><Topbar /><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!payment) return <><Topbar /><div className="p-6 text-center text-muted">Payment not found</div></>

  const docstatus = payment.docstatus
  const isDraft = docstatus === 0
  const isSubmitted = docstatus === 1
  const isCancelled = docstatus === 2

  return (
    <>
      <Topbar />
      <PageHead
        eyebrow="Payment Entry"
        title={payment.name}
        subtitle={
          [payment.party_name || payment.party, payment.company, payment.posting_date ? formatDate(payment.posting_date) : ""]
            .filter(Boolean)
            .join(" \u00b7 ") || "\u2014"
        }
        badge={statusBadge(docstatus, payment.status)}
        backTo="/payments"
        actions={
          <>
            {/* ERPNext get_action_status: draft clean -> Submit, draft dirty -> Save */}
            {isDraft && (dirty ? (
              <Button variant="primary" size="md" onClick={handleSave} data-testid="save_button">
                <Save size={16} /> Save
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={() => setConfirmAction("submit")}>
                <Check size={16} /> Submit
              </Button>
            ))}

            {/* Submitted: Cancel (secondary) or Update (primary when dirty) */}
            {isSubmitted && (dirty ? (
              <Button variant="primary" size="md" onClick={handleSave}>
                <Save size={16} /> Update
              </Button>
            ) : (
              <Button variant="secondary" size="md" onClick={() => setConfirmAction("cancel")}>
                <Ban size={16} /> Cancel
              </Button>
            ))}

            {/* Cancelled: Amend (primary) */}
            {isCancelled && (
              <Button variant="primary" size="md" onClick={() => setConfirmAction("amend")}>
                <GitBranch size={16} /> Amend
              </Button>
            )}

            {/* Draft: Accounting Ledger Preview */}
            {isDraft && (
              <Button variant="secondary" size="md" onClick={openLedgerPreview}>
                <BookOpen size={16} /> Accounting Ledger Preview
              </Button>
            )}

            {/* Three-dot menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="More actions">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isDraft && (
                  <>
                    <DropdownMenuItem onClick={() => setConfirmAction("delete")}>
                      <Trash2 size={14} className="text-danger-600" /> Delete
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {isSubmitted && (
                  <>
                    <DropdownMenuItem onClick={() => setConfirmAction("amend")}>
                      <GitBranch size={14} /> Amend
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/payments/new", { state: { copyFrom: payment } })}>
                      <Copy size={14} /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {isCancelled && (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/payments/new", { state: { copyFrom: payment } })}>
                      <Copy size={14} /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => window.open(`/printview?doctype=Payment Entry&name=${payment.name}`, "_blank")}>
                  <Printer size={14} /> Print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEmailOpen(true)}>
                  <Mail size={14} /> Email
                </DropdownMenuItem>
                {(isSubmitted || isCancelled) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirmAction("delete")}>
                      <Trash2 size={14} className="text-danger-600" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="bg-white rounded-2xl shadow-card p-6">
          {/* Form — single PaymentForm for ALL docstates */}
          <PaymentForm
            ref={formRef}
            mode="existing"
            initialValues={payment}
            onSaved={() => fetchPayment()}
            onCancel={() => navigate("/payments")}
            onDirtyChange={setDirty}
            hideFooter={true}
            ledger={ledgerData ? { data: ledgerData, loading: ledgerLoading, error: ledgerError } : undefined}
            comments={comments}
            commentsLoading={commentsLoading}
            onAddComment={handleAddComment}
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
        title={`Accounting Ledger \u2014 ${payment.name}`}
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
        {!ledgerLoading && !ledgerError && ledgerData && (() => {
          const { columns, rows } = normalizeLedger(ledgerData)
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {columns.map((col) => (
                      <th key={col.key} className="text-left py-2 px-2 text-xs font-semibold text-muted whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="py-4 text-center text-xs text-muted">
                        No ledger entries found.
                      </td>
                    </tr>
                  )}
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/30">
                      {columns.map((col, colIdx) => (
                        <td key={col.key} className="py-2 px-2 text-xs text-body whitespace-nowrap tabular-nums">
                          {formatNumber(row[colIdx])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
      </Modal>

      <SendPaymentEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        paymentName={payment.name}
        contactEmail={payment.contact_email}
      />
    </>
  )
}
