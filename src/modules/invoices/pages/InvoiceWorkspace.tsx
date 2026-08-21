"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  DollarSign,
  FileEdit,
  Plus,
  ChevronDown,
  Trash2,
  Save,
  FileText,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  Copy,
  Printer,
  Mail,
} from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import {
  Badge,
  Skeleton,
  Button,
  Modal,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui"
import { useMessageDialog, messageFromError } from "@/components/ui"
import {
  invoiceService,
  type LedgerPreviewData,
  type PaymentActivityItem,
} from "@/services"
import type { DocInfo } from "@/modules/payments/types"
import { ApiError } from "@/services/api-client"
import { useAuth } from "@/context/AuthContext"
import { normalizeLedger } from "@/modules/payments/components/ledgerUtils"
import LedgerPreviewTable from "@/modules/payments/components/LedgerPreviewTable"
import PaymentActivity from "@/modules/payments/components/PaymentActivity"
import InvoiceMetaPanel from "../components/InvoiceMetaPanel"
import type { SalesInvoice } from "../types"
import InvoiceForm, {
  type InvoiceFormData,
} from "../components/InvoiceForm"
import GetItemsFromTrigger from "../components/GetItemsFromTrigger"
import LoyaltyProgramDialog from "../components/LoyaltyProgramDialog"
import InvoiceLineItems from "../components/InvoiceLineItems"
import PrintPreviewDialog from "../components/PrintPreviewDialog"
import SendInvoiceEmailDialog from "../components/SendInvoiceEmailDialog"
import { formatDate } from "@/lib/utils"
import { useInvoiceWorkspace, type InvoiceWorkspaceMode } from "../hooks/useInvoiceWorkspace"

const statusVariant: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  Paid: "success",
  Unpaid: "warning",
  Draft: "default",
  Overdue: "danger",
  Cancelled: "default",
  Submitted: "info",
}

interface InvoiceWorkspaceProps {
  mode: InvoiceWorkspaceMode
  id?: string
}

export default function InvoiceWorkspace({
  mode,
  id,
}: InvoiceWorkspaceProps) {
  const ws = useInvoiceWorkspace({ mode, id })
  const { showMessage } = useMessageDialog()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null
  const navigate = useNavigate()

  const [createOpen, setCreateOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)

  // ERPNext-style collapsible form sidebar (Assignments & Tags). Persisted;
  // hidden on small screens where the fixed left rail leaves no room.
  const META_SIDEBAR_KEY = "blesserp_invoice_meta_sidebar"
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

  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerError, setLedgerError] = useState<string | null>(null)
  const [ledgerData, setLedgerData] = useState<LedgerPreviewData | null>(null)
  const [comments, setComments] = useState<PaymentActivityItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  const loadComments = useCallback(
    async (doc: SalesInvoice, currentUser: string | null, docinfo?: DocInfo) => {
      setCommentsLoading(true)
      try {
        setComments(await invoiceService.getActivity(doc, currentUser ?? undefined, docinfo))
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
    if (!ws.invoice) return
    loadComments(ws.invoice, currentUserId, ws.docinfo ?? undefined)
  }, [ws.invoice, ws.docinfo, currentUserId, loadComments])

  const loadLedger = useCallback(
    async (company: string, name: string) => {
      setLedgerLoading(true)
      setLedgerError(null)
      try {
        const data = await invoiceService.getAccountingLedgerPreview(company, name)
        setLedgerData(data)
      } catch (err) {
        setLedgerError(err instanceof ApiError ? err.message : "Failed to load ledger preview.")
        showMessage(messageFromError(err, "Failed to load the accounting ledger preview."))
      } finally {
        setLedgerLoading(false)
      }
    },
    [showMessage]
  )

  const openLedgerPreview = async () => {
    const doc = ws.invoice
    if (!doc) return
    setLedgerOpen(true)
    await loadLedger(doc.company, doc.name)
  }

  const handleAddComment = async (content: string) => {
    const doc = ws.invoice
    if (!doc) return
    await invoiceService.addComment(doc.name, content, user?.id ?? "", user?.name ?? "")
    await loadComments(doc, currentUserId)
  }

  const handleUpdateComment = async (commentName: string, content: string) => {
    const doc = ws.invoice
    if (!doc) return
    await invoiceService.updateComment(commentName, content)
    await loadComments(doc, currentUserId)
  }

  const handleDeleteComment = async (commentName: string) => {
    const doc = ws.invoice
    if (!doc) return
    await invoiceService.deleteComment(commentName)
    await loadComments(doc, currentUserId)
  }

  if (ws.loading) {
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

  if (mode === "existing" && !ws.invoice) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center text-muted py-24">Invoice not found.</div>
      </>
    )
  }

  const invoice = ws.invoice
  const isDocumentAmended = !!invoice?.amended_from

  const renderToolbar = () => {
    if (mode === "new") {
      return (
        <div className="flex items-center gap-3">
          {ws.loadingPartyDetails && (
            <span className="text-xs text-muted animate-pulse">Loading party details...</span>
          )}
          <GetItemsFromTrigger
            customer={ws.formData.customer}
            company={ws.formData.company || ws.companyDefaults?.company}
            formData={ws.formData as unknown as Record<string, unknown>}
            isReturn={!!ws.formData.isReturn}
            onItemsFetched={ws.handleAddItems}
            onTimesheetsFetched={(rows) =>
              ws.handleFormChange({
                timeSheets: rows as InvoiceFormData["timeSheets"],
              })
            }
          />
          <Button
            variant="primary"
            onClick={() => void ws.handleSave()}
            disabled={ws.saving || ws.loadingPartyDetails}
            loading={ws.saving}
            data-testid="save_button"
          >
            <Save size={16} />
            {ws.saving ? "Saving..." : "Save Draft"}
          </Button>
        </div>
      )
    }

    if (ws.isDraft) {
      return (
        <>
          {ws.loadingPartyDetails && (
            <span className="text-xs text-muted animate-pulse">Loading party details...</span>
          )}
          <GetItemsFromTrigger
            customer={ws.formData.customer}
            company={ws.formData.company || ws.companyDefaults?.company}
            formData={ws.formData as unknown as Record<string, unknown>}
            isReturn={!!ws.formData.isReturn}
            onItemsFetched={ws.handleAddItems}
            onTimesheetsFetched={(rows) =>
              ws.handleFormChange({
                timeSheets: rows as InvoiceFormData["timeSheets"],
              })
            }
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void openLedgerPreview()}
            title="Preview the GL entries this invoice will post"
          >
            <BookOpen size={14} /> Accounting Ledger
          </Button>
          {ws.dirty ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void ws.handleSave()}
              loading={ws.saving}
              data-testid="save_button"
            >
              <Save size={14} /> Save
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void ws.handleSubmit()}
              loading={ws.submitting}
              data-testid="submit_button"
            >
              <CheckCircle2 size={14} /> Submit
            </Button>
          )}
        </>
      )
    }

    if (ws.isSubmitted) {
      return (
        <>
          {ws.dirty ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void ws.handleSave()}
              loading={ws.saving}
              data-testid="save_button"
            >
              <CheckCircle2 size={14} /> Update
            </Button>
          ) : (
            <>
              {ws.anyCreate && (
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
                        {ws.canCreatePayment && (
                          <button
                            onClick={() => {
                              setCreateOpen(false)
                              navigate(
                                `/payments/new?invoice=${encodeURIComponent(ws.invoice!.name)}`,
                              )
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                          >
                            <DollarSign size={14} /> Payment
                          </button>
                        )}
                        {ws.canCreateReturn && (
                          <button
                            onClick={() => {
                              setCreateOpen(false)
                              navigate(
                                `/invoices/new?is_return=1&return_against=${encodeURIComponent(ws.invoice!.name)}`,
                              )
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                          >
                            <FileText size={14} /> Return / Credit Note
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              <Button variant="danger" size="sm" onClick={() => void ws.handleCancel()} loading={ws.submitting}>
                <XCircle size={14} /> Cancel
              </Button>
            </>
          )}
        </>
      )
    }

    if (ws.isCancelled) {
      return (
        <Button
          size="sm"
          onClick={() => void ws.handleAmend()}
          loading={ws.submitting}
          disabled={isDocumentAmended}
          title={isDocumentAmended ? "You cannot amend a document after it has been amended" : undefined}
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
        {ws.errorMessages.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-[14px] text-sm text-red-700">
            <p className="font-semibold mb-1">Please fix the following:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {ws.errorMessages.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {ws.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-[14px] text-sm text-red-700">
            {ws.error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Link
            to="/invoices"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors"
          >
            <ArrowLeft size={15} /> Back to Invoices
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
            {invoice && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" aria-label="More actions">
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate("/invoices/new", { state: { copyFrom: invoice } })}>
                      <Copy size={14} /> Duplicate
                    </DropdownMenuItem>
                    {(ws.isDraft || ws.isSubmitted) && (
                      <DropdownMenuItem onClick={() => setEmailOpen(true)}>
                        <Mail size={14} /> Email
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
                      <Printer size={14} /> Print
                    </DropdownMenuItem>
                    {(ws.isDraft || ws.isCancelled) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => void ws.handleDelete()}>
                          <Trash2 size={14} className="text-danger-600" /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <PrintPreviewDialog
                  open={previewOpen}
                  onOpenChange={setPreviewOpen}
                  invoiceName={invoice.name}
                />
                <SendInvoiceEmailDialog
                  open={emailOpen}
                  onOpenChange={setEmailOpen}
                  invoiceName={invoice.name}
                  contactEmail={invoice.contact_email}
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
                {invoice ? invoice.name : "New Invoice"}
              </h1>
              <p className="text-sm text-muted">
                {invoice ? formatDate(invoice.posting_date) : "Create a new sales invoice."}
              </p>
            </div>
          </div>
          {invoice && (
            <Badge variant={statusVariant[invoice.status] ?? "default"} className="px-3 py-1 text-sm">
              {invoice.status?.toUpperCase()}
            </Badge>
          )}
        </div>

        <div className="flex items-start gap-6">
          {mode === "existing" && metaOpen && ws.invoice && (
            <InvoiceMetaPanel
              name={ws.invoice.name}
              onCollapse={toggleMeta}
              initialDocInfo={ws.docinfo ?? undefined}
            />
          )}
          <div className="flex-1 min-w-0 space-y-6">
            <div className="bg-white rounded-2xl shadow-card p-6">
              <InvoiceForm
                formData={ws.formData}
                mode={mode}
                docstatus={ws.invoice?.docstatus}
                onChange={ws.handleFormChange}
                fieldErrors={ws.fieldErrors}
                taxRows={ws.taxRows}
                editableTaxRows={ws.editableTaxRows}
                onTaxRowsChange={
                  ws.editable
                    ? (rows) => {
                        ws.handleTaxRowsChange(rows)
                      }
                    : undefined
                }
                taxesAndChargesTemplate={ws.taxTemplate?.name ?? ""}
                onTaxTemplateChange={
                  ws.editable ? ws.handleTaxTemplateChange : undefined
                }
                onSelectCustomer={ws.editable ? ws.handleSelectCustomer : undefined}
                loadingPartyDetails={ws.loadingPartyDetails}
                companyDefaults={ws.companyDefaults}
                grandTotal={ws.grandTotal}
                subtotal={ws.subtotal}
                totalTaxesAndCharges={ws.totalTaxesAndCharges}
                totalTaxesAndChargesBase={ws.totalTaxesAndChargesBase}
                totalQuantity={ws.totalQuantity}
                netTotal={ws.netTotal}
                onSetWarehouse={ws.editable ? ws.handleSetWarehouse : undefined}
                itemLines={ws.lineItems}
                storedTaxBreakupHtml={ws.invoice?.other_charges_calculation}
                lineItems={
                  <InvoiceLineItems
                    items={ws.lineItems}
                    readOnly={!ws.editable}
                    customer={ws.formData.customer}
                    company={ws.formData.company || ws.companyDefaults?.company}
                    currency={
                      ws.formData.currency || ws.companyDefaults?.currency || "CAD"
                    }
                    taxCategory={ws.formData.taxCategory}
                    postingDate={ws.formData.issueDate}
                    onUpdate={ws.updateLine}
                    onRemove={ws.removeLine}
                    onAdd={ws.addLine}
                    onAddItemWithQty={ws.addItemWithQty}
                    onSelectProduct={ws.selectProduct}
                    itemDetailsContext={{
                      currency:
                        ws.formData.currency || ws.companyDefaults?.currency,
                      conversion_rate:
                        ws.formData.conversionRate ?? ws.conversionRate,
                      selling_price_list:
                        ws.formData.sellingPriceList ||
                        ws.companyDefaults?.defaultSellingPriceList,
                      price_list_currency:
                        ws.formData.priceListCurrency || ws.companyDefaults?.currency,
                      plc_conversion_rate:
                        ws.formData.plcConversionRate ?? ws.plcConversionRate,
                      customer: ws.formData.customer,
                      is_pos: ws.formData.isPos ? 1 : 0,
                      is_return: ws.formData.isReturn ? 1 : 0,
                    }}
                  />
                }
              />
            </div>
            {ws.invoice && (
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

        <LoyaltyProgramDialog
          open={ws.loyaltyProgramOptions.length > 1}
          customer={ws.formData.customer || ""}
          programs={ws.loyaltyProgramOptions}
          onClose={ws.clearLoyaltyProgramOptions}
        />

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
            return (
              <LedgerPreviewTable
                columns={columns}
                rows={rows}
                defaultCurrency={ws.formData.currency || ws.companyDefaults?.currency || "CAD"}
              />
            )
          })()}
        </Modal>
      </motion.div>
    </>
  )
}

export function InvoiceCreateWorkspace() {
  return <InvoiceWorkspace mode="new" />
}

export function InvoiceDetailWorkspace() {
  const { id } = useParams<{ id: string }>()
  return <InvoiceWorkspace mode="existing" id={id} />
}