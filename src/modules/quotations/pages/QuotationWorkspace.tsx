"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileEdit,
  Plus,
  ChevronDown,
  Trash2,
  Save,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  Copy,
  Printer,
  Mail,
  Frown,
  ShoppingCart,
  ReceiptText,
} from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import {
  Badge,
  Skeleton,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  useMessageDialog,
  messageFromError,
} from "@/components/ui"
import { quotationService } from "@/modules/quotations/services"
import type { PaymentActivityItem } from "@/modules/payments/types"
import { useAuth } from "@/context/AuthContext"
import PaymentActivity from "@/modules/payments/components/PaymentActivity"
import QuotationMetaPanel from "../components/QuotationMetaPanel"
import QuotationForm, { type QuotationFormHandle } from "../components/QuotationForm"
import SetLostDialog from "../components/SetLostDialog"
import QuotationPrintPreviewDialog from "../components/QuotationPrintPreviewDialog"
import SendQuotationEmailDialog from "../components/SendQuotationEmailDialog"
import type { Quotation, QuotationStatus } from "../types"
import { formatDate } from "@/lib/utils"

const statusVariant: Record<QuotationStatus, "success" | "info" | "warning" | "danger" | "default"> = {
  Draft: "default",
  Open: "info",
  Replied: "info",
  "Partially Ordered": "warning",
  Ordered: "success",
  Lost: "danger",
  Cancelled: "default",
  Expired: "default",
}

interface QuotationWorkspaceProps {
  mode: "new" | "existing"
  id?: string
}

export default function QuotationWorkspace({ mode, id }: QuotationWorkspaceProps) {
  const navigate = useNavigate()
  const { showMessage } = useMessageDialog()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null
  const formRef = useRef<QuotationFormHandle>(null)

  const [loading, setLoading] = useState(mode === "existing")
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [dirty, setDirty] = useState(false)
  const [acting, setActing] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)

  const [comments, setComments] = useState<PaymentActivityItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  const META_SIDEBAR_KEY = "blesserp_quotation_meta_sidebar"
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

  const loadDoc = useCallback(async (name: string) => {
    setLoading(true)
    try {
      const { doc } = await quotationService.getDoc(name)
      setQuotation(doc)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to load quotation."))
    } finally {
      setLoading(false)
    }
  }, [showMessage])

  useEffect(() => {
    if (mode === "existing" && id) {
      void loadDoc(id)
    }
  }, [mode, id, loadDoc])

  const loadComments = useCallback(
    async (doc: Quotation, currentUser: string | null) => {
      setCommentsLoading(true)
      try {
        setComments(await quotationService.getActivity(doc, currentUser ?? undefined))
      } catch (err) {
        setComments([])
        showMessage(messageFromError(err, "Failed to load activity."))
      } finally {
        setCommentsLoading(false)
      }
    },
    [showMessage]
  )

  useEffect(() => {
    if (!quotation) return
    loadComments(quotation, currentUserId)
  }, [quotation?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaved = (doc: Quotation) => {
    setQuotation(doc)
    setDirty(false)
    loadComments(doc, currentUserId)
  }

  const handleSave = async (action?: "Save" | "Update" | "Submit") => {
    if (acting) return
    setActing(true)
    try {
      const name = await formRef.current?.save(action)
      if (name) {
        showMessage("Quotation saved.")
        await loadDoc(name)
      }
    } catch (err) {
      showMessage(messageFromError(err, "Failed to save quotation."))
    } finally {
      setActing(false)
    }
  }

  const handleCancel = async () => {
    if (!quotation || acting) return
    setActing(true)
    try {
      await quotationService.cancel(quotation.name)
      showMessage("Quotation cancelled.")
      await loadDoc(quotation.name)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to cancel quotation."))
    } finally {
      setActing(false)
    }
  }

  const handleAmend = async () => {
    if (!quotation || acting) return
    setActing(true)
    try {
      const amended = await quotationService.amend(quotation)
      showMessage("Amended. New quotation created.")
      navigate(`/quotations/${amended.name}`)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to amend quotation."))
    } finally {
      setActing(false)
    }
  }

  const handleDuplicate = async () => {
    if (!quotation) return
    try {
      const copy = await quotationService.amend({ ...quotation, amended_from: undefined })
      navigate(`/quotations/${copy.name}`)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to duplicate quotation."))
    }
  }

  const handleDelete = async () => {
    if (!quotation || acting) return
    setActing(true)
    try {
      await quotationService.delete(quotation.name)
      showMessage("Quotation deleted.")
      navigate("/quotations")
    } catch (err) {
      showMessage(messageFromError(err, "Failed to delete quotation."))
    } finally {
      setActing(false)
    }
  }

  const handleCreateSO = async () => {
    if (!quotation) return
    try {
      const res = await quotationService.makeSalesOrder(quotation.name)
      navigate(`/sales-orders/${res.name}`)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to create Sales Order."))
    }
  }

  const handleCreateSI = async () => {
    if (!quotation) return
    try {
      const res = await quotationService.makeSalesInvoice(quotation.name)
      navigate(`/invoices/${res.name}`)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to create Sales Invoice."))
    }
  }

  const handleAddComment = async (content: string) => {
    const doc = quotation
    if (!doc) return
    await quotationService.addComment(doc.name, content, user?.id ?? "", user?.name ?? "")
    await loadComments(doc, currentUserId)
  }

  const handleUpdateComment = async (commentName: string, content: string) => {
    const doc = quotation
    if (!doc) return
    await quotationService.updateComment(commentName, content)
    await loadComments(doc, currentUserId)
  }

  const handleDeleteComment = async (commentName: string) => {
    const doc = quotation
    if (!doc) return
    await quotationService.deleteComment(commentName)
    await loadComments(doc, currentUserId)
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  if (mode === "existing" && !quotation) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center text-muted py-24">Quotation not found.</div>
      </>
    )
  }

  const docstatus = quotation?.docstatus ?? 0
  const isDraft = docstatus === 0
  const isSubmitted = docstatus === 1
  const isCancelled = docstatus === 2
  const isLost = quotation?.status === "Lost"
  const isOrdered = quotation?.status === "Ordered" || quotation?.status === "Partially Ordered"

  const renderToolbar = () => {
    if (mode === "new") {
      return (
        <Button
          variant="primary"
          onClick={() => void handleSave("Save")}
          disabled={acting}
          loading={acting}
          data-testid="save_button"
        >
          <Save size={16} />
          {acting ? "Saving..." : "Save Draft"}
        </Button>
      )
    }

    if (isDraft) {
      return dirty ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSave("Save")}
          loading={acting}
          data-testid="save_button"
        >
          <Save size={14} /> Save
        </Button>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSave("Submit")}
          loading={acting}
          disabled={isLost || isOrdered}
          data-testid="submit_button"
        >
          <CheckCircle2 size={14} /> Submit
        </Button>
      )
    }

    if (isSubmitted) {
      return dirty ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSave("Update")}
          loading={acting}
          data-testid="save_button"
        >
          <CheckCircle2 size={14} /> Update
        </Button>
      ) : (
        <>
          {!isOrdered && !isLost && (
            <div className="relative">
              <Button
                size="sm"
                onClick={() => setCreateOpen(!createOpen)}
                className="flex items-center gap-1"
              >
                <Plus size={14} /> Create <ChevronDown size={12} />
              </Button>
              {createOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setCreateOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 z-20 w-56 bg-white border border-border rounded-lg shadow-xl py-1">
                    <button
                      onClick={() => {
                        setCreateOpen(false)
                        void handleCreateSO()
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                    >
                      <ShoppingCart size={14} /> Sales Order
                    </button>
                    <button
                      onClick={() => {
                        setCreateOpen(false)
                        void handleCreateSI()
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                    >
                      <ReceiptText size={14} /> Sales Invoice
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <Button variant="danger" size="sm" onClick={() => void handleCancel()} loading={acting} disabled={isOrdered}>
            <XCircle size={14} /> Cancel
          </Button>
        </>
      )
    }

    if (isCancelled) {
      return (
        <Button
          size="sm"
          onClick={() => void handleAmend()}
          loading={acting}
          disabled={!!quotation?.amended_from}
          title={quotation?.amended_from ? "You cannot amend a document after it has been amended" : undefined}
        >
          <FileEdit size={14} /> Amend
        </Button>
      )
    }

    return null
  }

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <Link
            to="/quotations"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors"
          >
            <ArrowLeft size={15} /> Back to Quotations
          </Link>
          <div className="flex items-center gap-3">
            {mode === "existing" && (
              <Button
                variant="secondary"
                size="icon"
                className="hidden md:inline-flex"
                aria-label={metaOpen ? "Hide assignments & tags" : "Show assignments & tags"}
                title={metaOpen ? "Hide assignments & tags" : "Show assignments & tags"}
                onClick={toggleMeta}
              >
                {metaOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </Button>
            )}
            {renderToolbar()}
            {quotation && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" aria-label="More actions">
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void handleDuplicate()}>
                      <Copy size={14} /> Duplicate
                    </DropdownMenuItem>
                    {(isDraft || isSubmitted) && !isLost && (
                      <DropdownMenuItem onClick={() => setEmailOpen(true)}>
                        <Mail size={14} /> Email
                      </DropdownMenuItem>
                    )}
                    {(isSubmitted && !isOrdered && !isLost) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setLostOpen(true)}>
                          <Frown size={14} /> Set as Lost
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
                      <Printer size={14} /> Print
                    </DropdownMenuItem>
                    {(isDraft || isCancelled) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => void handleDelete()}>
                          <Trash2 size={14} className="text-danger-600" /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <QuotationPrintPreviewDialog
                  open={previewOpen}
                  onOpenChange={setPreviewOpen}
                  quotationName={quotation.name}
                  letterHead={quotation.letter_head}
                  language={quotation.language}
                />
                <SendQuotationEmailDialog
                  open={emailOpen}
                  onOpenChange={setEmailOpen}
                  quotationName={quotation.name}
                  contactEmail={quotation.contact_email}
                  customerName={quotation.customer_name}
                />
                <SetLostDialog
                  open={lostOpen}
                  onOpenChange={setLostOpen}
                  quotationName={quotation.name}
                  onDeclaredLost={() => {
                    void loadDoc(quotation.name)
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-primary-50 text-primary-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-heading">
                {quotation ? quotation.name : "New Quotation"}
              </h1>
              <p className="text-sm text-muted">
                {quotation ? `${quotation.customer_name || quotation.party_name} • ${formatDate(quotation.transaction_date)}` : "Create a new quotation."}
              </p>
            </div>
          </div>
          {quotation && (
            <Badge variant={statusVariant[quotation.status] ?? "default"} className="px-3 py-1 text-sm">
              {quotation.status?.toUpperCase()}
            </Badge>
          )}
        </div>

        <div className="flex items-start gap-6">
          {mode === "existing" && metaOpen && quotation && (
            <QuotationMetaPanel name={quotation.name} onCollapse={toggleMeta} />
          )}
          <div className="flex-1 min-w-0 space-y-6">
            <div className="bg-white rounded-2xl shadow-card p-6">
              <QuotationForm
                ref={formRef}
                quotation={quotation}
                mode={mode === "new" ? "create" : "edit"}
                onSaved={handleSaved}
                onDirtyChange={setDirty}
              />
            </div>
            {quotation && (
              <PaymentActivity
                activity={comments}
                loading={commentsLoading}
                onAddComment={handleAddComment}
                onUpdateComment={handleUpdateComment}
                onDeleteComment={handleDeleteComment}
                currentUserId={currentUserId}
              />
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}

export function QuotationCreateWorkspace() {
  return <QuotationWorkspace mode="new" />
}

export function QuotationDetailWorkspace() {
  const { id } = useParams<{ id: string }>()
  return <QuotationWorkspace mode="existing" id={id} />
}