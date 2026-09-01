"use client"

/**
 * Sales Order workspace — parity with QuotationWorkspace but for the
 * editable Sales Order form. Renders a docstatus/status-driven toolbar
 * (Save/Submit, Update/Cancel, Amend, Create menu, More menu) around the
 * embedded $SalesOrderForm and the $PaymentActivity timeline, and exposes
 * the routed Create / Detail wrappers.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
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
  Receipt,
  Hammer,
  PackageOpen,
  ShoppingBag,
  Wrench,
  ClipboardList,
  CreditCard,
  Landmark,
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
import { salesOrderService } from "@/modules/sales-orders/services"
import type { PaymentActivityItem } from "@/modules/payments/types"
import { useAuth } from "@/context/AuthContext"
import PaymentActivity from "@/modules/payments/components/PaymentActivity"
import SalesOrderForm, { type SalesOrderFormHandle } from "../components/SalesOrderForm"
import type { SalesOrderDoc, SalesOrderMappedDoc, SalesOrderStatus } from "../types"
import { formatDate } from "@/lib/utils"

const statusVariant: Record<SalesOrderStatus, "success" | "info" | "warning" | "danger" | "default"> = {
  Draft: "default",
  "On Hold": "warning",
  "To Deliver and Bill": "info",
  "To Bill": "info",
  "To Deliver": "info",
  Completed: "success",
  Cancelled: "danger",
  Closed: "default",
}

interface SalesOrderWorkspaceProps {
  mode: "new" | "existing"
  id?: string
}

// make_mapped_doc returns an UNSAVED prefilled doc (no server name). Routes
// it into the create form as the initial `SalesOrderDoc`: force draft state
// and drop child-row names so nothing stale gets posted on the eventual save.
function normalizeMappedDoc(doc: SalesOrderMappedDoc): SalesOrderDoc {
  const stripNames = <T extends { name?: unknown }>(rows: T[] | undefined): Omit<T, "name">[] =>
    (rows ?? []).map(({ name: _n, ...rest }) => rest)
  return {
    ...(doc as unknown as SalesOrderDoc),
    doctype: "Sales Order",
    docstatus: 0,
    status: "Draft",
    items: stripNames(doc.items) as SalesOrderDoc["items"],
    taxes: stripNames(doc.taxes) as SalesOrderDoc["taxes"],
    payment_schedule: stripNames(doc.payment_schedule) as SalesOrderDoc["payment_schedule"],
    pricing_rules: stripNames(doc.pricing_rules) as SalesOrderDoc["pricing_rules"],
    packed_items: stripNames(doc.packed_items) as SalesOrderDoc["packed_items"],
    sales_team: stripNames(doc.sales_team) as SalesOrderDoc["sales_team"],
  }
}

const CREATE_TARGETS = [
  { key: "Delivery Note", label: "Delivery Note", make: salesOrderService.makeDeliveryNote, icon: PackageOpen },
  { key: "Sales Invoice", label: "Sales Invoice", make: salesOrderService.makeSalesInvoice, icon: Receipt },
  { key: "Work Order", label: "Work Order(s)", make: salesOrderService.makeWorkOrders, icon: Wrench },
  { key: "Material Request", label: "Material Request", make: salesOrderService.makeMaterialRequest, icon: ClipboardList },
  { key: "Purchase Order", label: "Purchase Order", make: salesOrderService.makePurchaseOrder, icon: ShoppingBag },
  { key: "Maintenance Schedule", label: "Maintenance Schedule", make: salesOrderService.makeMaintenanceSchedule, icon: Hammer },
  { key: "Maintenance Visit", label: "Maintenance Visit", make: salesOrderService.makeMaintenanceVisit, icon: Hammer },
  { key: "Project", label: "Project", make: salesOrderService.makeProject, icon: FileText },
  { key: "Pick List", label: "Pick List", make: salesOrderService.createPickList, icon: PackageOpen },
  { key: "Payment Request", label: "Payment Request", make: salesOrderService.makePaymentRequest, icon: CreditCard },
  { key: "Payment Entry", label: "Payment Entry", make: salesOrderService.makePaymentEntry, icon: Landmark },
] as const

export default function SalesOrderWorkspace({ mode, id }: SalesOrderWorkspaceProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { showMessage } = useMessageDialog()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null
  const formRef = useRef<SalesOrderFormHandle>(null)

  const mappedPrefill =
    mode === "new"
      ? (location.state as { mappedDoc?: SalesOrderMappedDoc } | null)?.mappedDoc
      : undefined

  const [loading, setLoading] = useState(mode === "existing")
  const [salesOrder, setSalesOrder] = useState<SalesOrderDoc | null>(() =>
    mappedPrefill ? normalizeMappedDoc(mappedPrefill) : null,
  )
  const [dirty, setDirty] = useState(false)
  const [acting, setActing] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const [comments, setComments] = useState<PaymentActivityItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  const META_SIDEBAR_KEY = "blesserp_sales_order_meta_sidebar"
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
      const { doc } = await salesOrderService.getDoc(name)
      setSalesOrder(doc)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to load sales order."))
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
    async (doc: SalesOrderDoc, currentUser: string | null) => {
      setCommentsLoading(true)
      try {
        setComments(await salesOrderService.getActivity(doc, currentUser ?? undefined))
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
    if (!salesOrder || !salesOrder.name) return
    loadComments(salesOrder, currentUserId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesOrder?.name])

  const handleSaved = (doc: SalesOrderDoc) => {
    setSalesOrder(doc)
    setDirty(false)
    loadComments(doc, currentUserId)
  }

  const handleSave = async (action?: "Save" | "Update" | "Submit") => {
    if (acting) return
    setActing(true)
    try {
      const name = await formRef.current?.save(action)
      if (name) {
        showMessage(action === "Submit" ? "Sales Order submitted." : mode === "new" ? "Sales Order saved." : "Sales Order updated.")
        if (mode === "new") navigate(`/sales-orders/${name}`)
        else await loadDoc(name)
      }
    } catch (err) {
      showMessage(messageFromError(err, action === "Submit" ? "Failed to submit sales order." : "Failed to save sales order."))
    } finally {
      setActing(false)
    }
  }

  const handleCancelDoc = async () => {
    if (!salesOrder || acting) return
    setActing(true)
    try {
      await salesOrderService.cancelDoc(salesOrder.name)
      showMessage("Sales Order cancelled.")
      await loadDoc(salesOrder.name)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to cancel sales order."))
    } finally {
      setActing(false)
    }
  }

  const handleAmend = async () => {
    if (!salesOrder || acting) return
    setActing(true)
    try {
      const amended = await salesOrderService.amend(salesOrder)
      showMessage("Amended. New sales order created.")
      navigate(`/sales-orders/${amended.name}`)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to amend sales order."))
    } finally {
      setActing(false)
    }
  }

  const handleDuplicate = async () => {
    if (!salesOrder) return
    try {
      const copy = await salesOrderService.amend({ ...salesOrder, amended_from: undefined })
      navigate(`/sales-orders/${copy.name}`)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to duplicate sales order."))
    }
  }

  const handleDelete = async () => {
    if (!salesOrder || acting) return
    setActing(true)
    try {
      await salesOrderService.delete(salesOrder.name)
      showMessage("Sales Order deleted.")
      navigate("/sales-orders")
    } catch (err) {
      showMessage(messageFromError(err, "Failed to delete sales order."))
    } finally {
      setActing(false)
    }
  }

  const handleStatus = async (status: string, successMsg: string) => {
    if (!salesOrder || acting) return
    setActing(true)
    try {
      await salesOrderService.updateStatus(salesOrder.name, status)
      showMessage(successMsg)
      await loadDoc(salesOrder.name)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to update status."))
    } finally {
      setActing(false)
    }
  }

  const handleCreate = async (
    target: (typeof CREATE_TARGETS)[number],
  ) => {
    if (!salesOrder) return
    try {
      const res = await target.make(salesOrder.name)
      const route = target.key === "Sales Invoice"
        ? `/invoices/${res.name}`
        : target.key === "Payment Request" || target.key === "Payment Entry"
          ? `/payments/${res.name}`
          : null
      if (route) {
        navigate(route)
      } else {
        showMessage(`${target.key} module not available yet (created ${res.doctype}: ${res.name}).`)
      }
    } catch (err) {
      showMessage(messageFromError(err, `Failed to create ${target.key}.`))
    }
  }

  const handleAddComment = async (content: string) => {
    const doc = salesOrder
    if (!doc) return
    await salesOrderService.addComment(doc.name, content, user?.id ?? "", user?.name ?? "")
    await loadComments(doc, currentUserId)
  }

  const handleUpdateComment = async (commentName: string, content: string) => {
    const doc = salesOrder
    if (!doc) return
    await salesOrderService.updateComment(commentName, content)
    await loadComments(doc, currentUserId)
  }

  const handleDeleteComment = async (commentName: string) => {
    const doc = salesOrder
    if (!doc) return
    await salesOrderService.deleteComment(commentName)
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

  if (mode === "existing" && !salesOrder) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center text-muted py-24">Sales Order not found.</div>
      </>
    )
  }

  const docstatus = salesOrder?.docstatus ?? 0
  const isDraft = docstatus === 0
  const isSubmitted = docstatus === 1
  const isCancelled = docstatus === 2
  const status = salesOrder?.status ?? "Draft"
  const isOnHold = status === "On Hold"
  const isClosed = status === "Closed"
  const isCompleted = status === "Completed"

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
      return (
        <>
          <div className="relative">
            <Button
              size="sm"
              onClick={() => setCreateOpen((v) => !v)}
              className="flex items-center gap-1"
              title="Create"
            >
              <Plus size={14} /> Create <ChevronDown size={12} />
            </Button>
            {createOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setCreateOpen(false)}
                />
                <div className="absolute right-0 mt-1 z-20 w-56 bg-white border border-border rounded-lg shadow-xl py-1 max-h-96 overflow-auto">
                  {CREATE_TARGETS.map((target) => (
                    <button
                      key={target.key}
                      onClick={() => {
                        setCreateOpen(false)
                        void handleCreate(target)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                    >
                      <target.icon size={14} /> {target.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {dirty ? (
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
              data-testid="submit_button"
            >
              <CheckCircle2 size={14} /> Submit
            </Button>
          )}
        </>
      )
    }

    if (isSubmitted) {
      return (
        <>
          <div className="relative">
            <Button
              size="sm"
              onClick={() => setCreateOpen((v) => !v)}
              className="flex items-center gap-1"
              title="Create"
            >
              <Plus size={14} /> Create <ChevronDown size={12} />
            </Button>
            {createOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setCreateOpen(false)}
                />
                <div className="absolute right-0 mt-1 z-20 w-56 bg-white border border-border rounded-lg shadow-xl py-1 max-h-96 overflow-auto">
                  {CREATE_TARGETS.map((target) => (
                    <button
                      key={target.key}
                      onClick={() => {
                        setCreateOpen(false)
                        void handleCreate(target)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                    >
                      <target.icon size={14} /> {target.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {dirty && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSave("Update")}
              loading={acting}
              data-testid="save_button"
            >
              <CheckCircle2 size={14} /> Update
            </Button>
          )}
          {!isOnHold && !isCompleted && !isClosed && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleStatus("On Hold", "Sales Order placed on hold.")}
              loading={acting}
            >
              On Hold
            </Button>
          )}
          {(isOnHold || isClosed) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleStatus("To Deliver and Bill", "Sales Order resumed.")}
              loading={acting}
            >
              Resume
            </Button>
          )}
          {!isClosed && !isCompleted && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleStatus("Closed", "Sales Order closed.")}
              loading={acting}
            >
              Close
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => void handleCancelDoc()} loading={acting}>
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
          disabled={!!salesOrder?.amended_from}
          title={salesOrder?.amended_from ? "You cannot amend a document after it has been amended" : undefined}
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
            to="/sales-orders"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors"
          >
            <ArrowLeft size={15} /> Back to Sales Orders
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
            {salesOrder && (
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
                  <DropdownMenuItem onClick={() => showMessage("Email not available yet.")}>
                    <Mail size={14} /> Email
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => showMessage("Print not available yet.")}>
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
                {salesOrder ? salesOrder.name : "New Sales Order"}
              </h1>
              <p className="text-sm text-muted">
                {salesOrder ? `${salesOrder.customer_name || salesOrder.customer || ""} • ${formatDate(salesOrder.transaction_date)}` : "Create a new sales order."}
              </p>
            </div>
          </div>
          {salesOrder && (
            <Badge variant={statusVariant[salesOrder.status] ?? "default"} className="px-3 py-1 text-sm">
              {salesOrder.status?.toUpperCase()}
            </Badge>
          )}
        </div>

        <div className="flex items-start gap-6">
          {mode === "existing" && metaOpen && salesOrder && (
            <div className="hidden lg:block w-72 shrink-0">
              <div className="bg-white rounded-2xl shadow-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-heading">Assignments & Tags</h3>
                  <button type="button" onClick={toggleMeta} className="text-muted hover:text-body" aria-label="Collapse panel">
                    <PanelLeftClose size={15} />
                  </button>
                </div>
                <p className="text-xs text-muted">Volunteer / To Do metadata panel — placeholder for the SO meta sidebar.</p>
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-6">
            <div className="bg-white rounded-2xl shadow-card p-6">
              <SalesOrderForm
                ref={formRef}
                doc={salesOrder}
                mode={mode === "new" ? "create" : "edit"}
                onSaved={handleSaved}
                onDirtyChange={setDirty}
              />
            </div>
            {salesOrder && (
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

export function SalesOrderCreateWorkspace() {
  return <SalesOrderWorkspace mode="new" />
}

export function SalesOrderDetailWorkspace() {
  const { id } = useParams<{ id: string }>()
  return <SalesOrderWorkspace mode="existing" id={id} />
}
