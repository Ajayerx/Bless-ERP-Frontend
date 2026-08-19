"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { BookOpen, Check, Save, Ban, GitBranch, Copy, Mail, Printer, Trash2, MoreHorizontal, Table2, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import PageHead from "@/components/layout/PageHead"
import { Badge, Button, Skeleton, Modal } from "@/components/ui"
import { useMessageDialog, messageFromError } from "@/components/ui"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui"
import { ConfirmationDialog } from "@/components/ui"
import { paymentService, setMatchedPaymentRequests, type PaymentEntry, type LedgerPreviewData, type PaymentActivityItem, type PaymentAfterSaveResult } from "@/services"
import { ApiError } from "@/services/api-client"
import { useCompany } from "@/context/CompanyContext"
import { useAuth } from "@/context/AuthContext"
import PaymentForm, { type PaymentFormHandle } from "../components/PaymentForm"
import { normalizeLedger } from "../components/ledgerUtils"
import LedgerPreviewTable from "../components/LedgerPreviewTable"
import SendPaymentEmailDialog from "../components/SendPaymentEmailDialog"
import UnReconcileDialog from "../components/UnReconcileDialog"
import PaymentActivity from "../components/PaymentActivity"
import PaymentMetaPanel from "../components/PaymentMetaPanel"

function statusBadge(docstatus: number, status: string) {
  if (docstatus === 1) return <Badge variant="success">Submitted</Badge>
  if (docstatus === 2) return <Badge variant="danger">Cancelled</Badge>
  return <Badge variant="warning">{status || "Draft"}</Badge>
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return iso
  }
}

// ERPNext "Ledger" action: navigates to the General Ledger report pre-filtered
// for this voucher (mirrors payment_entry.js show_general_ledger).
function glReportParams(p: PaymentEntry): string {
  const qp = new URLSearchParams({
    voucher_no: p.name,
    from_date: p.posting_date,
    to_date: (p.modified || new Date().toISOString().slice(0, 10)).slice(0, 10),
    company: p.company,
    categorize_by: "Categorize by Voucher (Consolidated)",
    show_cancelled_entries: p.docstatus === 2 ? "1" : "0",
  })
  return qp.toString()
}

// ERPNext "View Exchange Gain/Loss Journals" action: opens the Journal Entry
// list filtered to the FX gain/loss journals created for this voucher.
function exchangeGainLossUrl(p: PaymentEntry): string {
  const qp = new URLSearchParams({
    voucher_type: "Exchange Gain Or Loss",
    reference_name: p.name,
  })
  return `${window.location.origin}/app/journal-entry?${qp.toString()}`
}

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const formRef = useRef<PaymentFormHandle>(null)
  const { defaultCurrency } = useCompany()
  const { showMessage } = useMessageDialog()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null
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
  const [comments, setComments] = useState<PaymentActivityItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  // ERPNext-style collapsible form sidebar (Assignments & Tags). Persisted;
  // hidden on small screens where the fixed left rail leaves no room.
  const META_SIDEBAR_KEY = "blesserp_payment_meta_sidebar"
  const [metaOpen, setMetaOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(META_SIDEBAR_KEY) !== "0"
    } catch {
      return true
    }
  })

  const toggleMeta = useCallback(() => {
    setMetaOpen((open) => {
      const next = !open
      try {
        localStorage.setItem(META_SIDEBAR_KEY, next ? "1" : "0")
      } catch {
        // ignore persistence failures
      }
      return next
    })
  }, [])

  // Open the Payment Entry print PDF in a new tab by fetching it as a Blob,
  // rather than navigating to an SPA fallback route.
  const openPrint = useCallback(async () => {
    if (!payment) return
    try {
      const blob = await paymentService.generatePDF(payment.name)
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, "_blank")
    } catch {
      showMessage("Failed to generate PDF")
    }
  }, [payment, showMessage])

  // ERPNext header actions
  const [unreconcileAvailable, setUnreconcileAvailable] = useState(false)
  const [unreconcileOpen, setUnreconcileOpen] = useState(false)
  const [bankLinked, setBankLinked] = useState<string[] | null>(null)
  const [amendedAs, setAmendedAs] = useState<string | boolean>(false)
  const [matchedRequests, setMatchedRequests] = useState<string[][] | null>(null)

  const fetchPayment = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const p = await paymentService.getById(id)
      setPayment(p)
    } catch (err) {
      setPayment(null)
      showMessage(messageFromError(err, "Failed to load the payment entry."))
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
      showMessage(messageFromError(err, "Failed to load the accounting ledger preview."))
    } finally {
      setLedgerLoading(false)
    }
  }, [])

  const loadComments = useCallback(async (doc: PaymentEntry, currentUser: string | null) => {
    setCommentsLoading(true)
    try {
      setComments(await paymentService.getActivity(doc, currentUser ?? undefined))
    } catch (err) {
      setComments([])
      showMessage(messageFromError(err, "Failed to load activity."))
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!payment) return
    loadComments(payment, currentUserId)
  }, [payment, currentUserId, loadComments])

  // UnReconcile is only shown for submitted entries that actually reference
  // other documents (mirrors unreconcile.js add_unreconcile_btn).
  useEffect(() => {
    if (!payment || payment.docstatus !== 1) {
      setUnreconcileAvailable(false)
      return
    }
    let cancelled = false
    paymentService.unreconcile
      .docHasReferences("Payment Entry", payment.name)
      .then((count) => {
        if (!cancelled) setUnreconcileAvailable(count > 0)
      })
      .catch(() => {
        if (!cancelled) setUnreconcileAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [payment])

  // A Cancelled Payment Entry that already has an amended copy cannot be
  // amended again (mirrors ERPNext toolbar.js is_document_amended).
  useEffect(() => {
    if (!payment || payment.docstatus !== 2) {
      setAmendedAs(false)
      return
    }
    let cancelled = false
    paymentService
      .isDocumentAmended(payment.name)
      .then((amended) => {
        if (!cancelled) setAmendedAs(typeof amended === "string" ? amended : false)
      })
      .catch(() => {
        if (!cancelled) setAmendedAs(false)
      })
    return () => {
      cancelled = true
    }
  }, [payment])

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
        const linked = await paymentService.getLinkedBankTransactions(payment.name)
        if (linked.length) {
          setBankLinked(linked)
        } else {
          await paymentService.cancelPayment(payment.name)
          await fetchPayment()
        }
      } else if (confirmAction === "delete") {
        await paymentService.deletePayment(payment.name)
        navigate("/payments")
      } else if (confirmAction === "amend") {
        const original = await paymentService.getById(payment.name)
        navigate("/payments/new", { state: { amendFrom: original } })
      }
      setConfirmAction(null)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Action failed. Please try again."
      setConfirmError(message)
      showMessage(messageFromError(err, message))
    } finally {
      setActing(false)
    }
  }

  // A submitted Payment Entry reconciled with Bank Transactions can only be
  // cancelled if the user accepts that reconciliation will be removed.
  const confirmCancelWithBankTx = async () => {
    if (!payment) return
    setActing(true)
    setConfirmError(null)
    try {
      await paymentService.cancelPayment(payment.name)
      setBankLinked(null)
      await fetchPayment()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to cancel the Payment Entry."
      setConfirmError(message)
      showMessage(messageFromError(err, message))
    } finally {
      setActing(false)
    }
  }

  const openGeneralLedger = () => {
    if (payment) navigate(`/reports/general-ledger?${glReportParams(payment)}`)
  }

  const openExchangeGainLoss = () => {
    if (payment) window.open(exchangeGainLossUrl(payment), "_blank", "noopener,noreferrer")
  }

  const handleAfterSave = (result: PaymentAfterSaveResult) => {
    if (result.matchedPaymentRequests && result.matchedPaymentRequests.length > 0) {
      setMatchedRequests(result.matchedPaymentRequests)
    }
  }

  const handleAllocateMatched = async () => {
    if (!payment || !matchedRequests) return
    setActing(true)
    setConfirmError(null)
    try {
      await setMatchedPaymentRequests(payment as unknown as Record<string, unknown>, matchedRequests)
      setMatchedRequests(null)
      setDirty(true)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to allocate the matched payment requests."
      setConfirmError(message)
      showMessage(messageFromError(err, message))
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
    await paymentService.addComment(payment.name, content, user?.id ?? "", user?.name ?? "")
    await loadComments(payment, currentUserId)
  }

  const handleUpdateComment = async (commentName: string, content: string) => {
    if (!payment) return
    await paymentService.updateComment(commentName, content)
    await loadComments(payment, currentUserId)
  }

  const handleDeleteComment = async (commentName: string) => {
    if (!payment) return
    await paymentService.deleteComment(commentName)
    await loadComments(payment, currentUserId)
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
  const hasExchangeGainLoss = (payment.references ?? []).some((r) => r.exchange_gain_loss !== 0)

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
            {/* Collapsible Assignments & Tags sidebar toggle (ERPNext form sidebar);
                labeled so it is discoverable, collapses to a plain icon on small headers */}
            <Button
              variant="secondary"
              size="md"
              className="hidden md:inline-flex"
              aria-label={metaOpen ? "Hide assignments & tags" : "Show assignments & tags"}
              onClick={toggleMeta}
            >
              {metaOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              <span className="ml-1.5">{metaOpen ? "Hide" : "Show"} Assignments</span>
            </Button>
            {/* Draft: Accounting Ledger Preview */}
            {isDraft && (
              <Button variant="secondary" size="md" onClick={openLedgerPreview}>
                <BookOpen size={16} /> Accounting Ledger
              </Button>
            )}
            {/* Submitted/Cancelled: General Ledger report (ERPNext "Ledger") */}
            {!isDraft && (
              <Button variant="secondary" size="md" onClick={openGeneralLedger}>
                <Table2 size={16} /> Ledger
              </Button>
            )}
            {/* Any doc with FX gain/loss references: journal list (ERPNext) */}
            {hasExchangeGainLoss && (
              <Button variant="secondary" size="md" onClick={openExchangeGainLoss}>
                <BookOpen size={16} /> View Exchange Gain/Loss
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
                {/* Duplicate: ERPNext shows it for all docstatus (can_create && !allow_copy) */}
                <DropdownMenuItem onClick={() => navigate("/payments/new", { state: { copyFrom: payment } })}>
                  <Copy size={14} /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void openPrint()}>
                  <Printer size={14} /> Print
                </DropdownMenuItem>
                {/* Email: ERPNext shows it for docstatus < 2 (draft + submitted) */}
                {(isDraft || isSubmitted) && (
                  <DropdownMenuItem onClick={() => setEmailOpen(true)}>
                    <Mail size={14} /> Email
                  </DropdownMenuItem>
                )}
                {unreconcileAvailable && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setUnreconcileOpen(true)}>
                      <GitBranch size={14} /> UnReconcile
                    </DropdownMenuItem>
                  </>
                )}
                {/* Delete: ERPNext hides it for submitted (docstatus == 1) */}
                {(isDraft || isCancelled) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirmAction("delete")}>
                      <Trash2 size={14} className="text-danger-600" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Primary action last, on the far right (ERPNext primary action placement) */}
            {isDraft && (dirty ? (
              <Button variant="primary" size="md" onClick={handleSave} data-testid="save_button">
                <Save size={16} /> Save
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={() => setConfirmAction("submit")}>
                <Check size={16} /> Submit
              </Button>
            ))}
            {isSubmitted && (dirty ? (
              <Button variant="primary" size="md" onClick={handleSave}>
                <Save size={16} /> Update
              </Button>
            ) : (
              <Button variant="secondary" size="md" onClick={() => setConfirmAction("cancel")}>
                <Ban size={16} /> Cancel
              </Button>
            ))}
            {isCancelled && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setConfirmAction("amend")}
                disabled={!!amendedAs}
                title={amendedAs ? `Already amended as ${amendedAs}` : undefined}
              >
                <GitBranch size={16} /> Amend
              </Button>
            )}
          </>
        }
      />
<motion.div className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-start gap-6">
          {metaOpen && <PaymentMetaPanel name={payment.name} onCollapse={toggleMeta} />}
          <div className="flex-1 min-w-0 space-y-6">
            <div className="bg-white rounded-2xl shadow-card p-6">
              {/* Form — single PaymentForm for ALL docstates */}
              <PaymentForm
                ref={formRef}
                mode="existing"
                initialValues={payment}
                onSaved={() => fetchPayment()}
                onCancel={() => navigate("/payments")}
                onDirtyChange={setDirty}
                onAfterSave={handleAfterSave}
                hideFooter={true}
                ledger={ledgerData ? { data: ledgerData, loading: ledgerLoading, error: ledgerError } : undefined}
              />
            </div>
            <PaymentActivity
              activity={comments}
              loading={commentsLoading}
              onAddComment={handleAddComment}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              currentUserId={currentUserId}
            />
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
        title={confirmTitle ?? ""}
        description={confirmMessage ?? ""}
        confirmLabel={confirmAction === "delete" ? "Delete" : confirmAction === "submit" ? "Submit" : confirmAction === "cancel" ? "Cancel Payment" : "Amend"}
        cancelLabel="No, go back"
        variant={confirmAction === "delete" || confirmAction === "cancel" ? "danger" : "warning"}
        loading={acting}
        error={confirmError}
      />

      {/* Accounting Ledger Preview dialog */}
      <Modal
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        title="Accounting Ledger Preview"
        size="xl"
        className="max-w-[1140px]"
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
          return <LedgerPreviewTable columns={columns} rows={rows} defaultCurrency={defaultCurrency} />
        })()}
      </Modal>

      <SendPaymentEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        paymentName={payment.name}
        contactEmail={payment.contact_email}
      />

      {/* UnReconcile (ERPNext unreconcile.js) */}
      <UnReconcileDialog
        open={unreconcileOpen}
        onOpenChange={setUnreconcileOpen}
        company={payment.company}
        docname={payment.name}
        onDone={() => {
          setUnreconcileOpen(false)
          setDirty(true)
        }}
      />

      {/* Cancel blocked by linked Bank Transactions */}
      <ConfirmationDialog
        open={bankLinked !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBankLinked(null)
            setConfirmError(null)
          }
        }}
        onConfirm={confirmCancelWithBankTx}
        title="Bank Transactions are Linked to this Payment"
        description={`The following Bank Transaction(s) are matched with this Payment Entry. Cancelling will automatically remove the reconciliation: ${(bankLinked ?? []).join(", ")}. Proceed?`}
        confirmLabel="Cancel Payment"
        cancelLabel="No, go back"
        variant="danger"
        loading={acting}
        error={confirmError}
      />

      {/* Matched Payment Requests prompt (ERPNext after_save) */}
      <ConfirmationDialog
        open={matchedRequests !== null}
        onOpenChange={(open) => {
          if (!open) setMatchedRequests(null)
        }}
        onConfirm={handleAllocateMatched}
        title="Allocate Matched Payment Requests?"
        description={`${(matchedRequests ?? []).length} payment request(s) matched this Payment Entry. Allocate them and link the resulting bank transaction to this entry?`}
        confirmLabel="Allocate"
        variant="warning"
        loading={acting}
        error={confirmError}
      />
    </>
  )
}
