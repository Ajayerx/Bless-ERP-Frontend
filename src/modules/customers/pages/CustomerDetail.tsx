"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Save, Pencil, Trash2, ChevronDown, FileText, BarChart3, ExternalLink, ShoppingCart, DollarSign, TrendingUp, MoreHorizontal, PanelLeftClose, PanelLeftOpen, XCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import PageHead from "@/components/layout/PageHead"
import { Badge, Button, Skeleton, Modal, useMessageDialog, messageFromError } from "@/components/ui"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui"
import { customerService, type CustomerDetail, type PaymentActivityItem } from "@/services"
import { ApiError } from "@/services/api-client"
import { useAuth } from "@/context/AuthContext"
import { rewriteErpNextLinks } from "@/lib/utils"
import CustomerForm, { type CustomerFormHandle } from "../components/CustomerForm"
import CustomerMetaPanel from "../components/CustomerMetaPanel"
import PaymentActivity from "@/modules/payments/components/PaymentActivity"

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const formRef = useRef<CustomerFormHandle>(null)
  const { showMessage } = useMessageDialog()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<{ message: string; rawMessage: string } | null>(null)

  const [activity, setActivity] = useState<PaymentActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  // ERPNext-style collapsible form sidebar (Assignments & Tags). Persisted;
  // hidden on small screens where the fixed left rail leaves no room.
  const META_SIDEBAR_KEY = "blesserp_customer_meta_sidebar"
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

  const fetchCustomer = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const c = await customerService.getById(id)
      setCustomer(c)
    } catch (err) {
      setCustomer(null)
      showMessage(messageFromError(err, "Failed to load the customer."))
    } finally {
      setLoading(false)
    }
  }, [id, showMessage])

  useEffect(() => { fetchCustomer() }, [fetchCustomer])

  const loadActivity = useCallback(async (doc: CustomerDetail, currentUser: string | null) => {
    setActivityLoading(true)
    try {
      setActivity(await customerService.getActivity(doc, currentUser ?? undefined))
    } catch (err) {
      setActivity([])
      showMessage(messageFromError(err, "Failed to load activity."))
    } finally {
      setActivityLoading(false)
    }
  }, [showMessage])

  useEffect(() => {
    if (!customer) return
    loadActivity(customer, currentUserId)
  }, [customer, currentUserId, loadActivity])

  const handleSave = async () => {
    const savedName = await formRef.current?.save()
    if (savedName) {
      showMessage("Customer saved.")
      await fetchCustomer()
    }
  }

  const handleAddComment = async (content: string) => {
    if (!id) return
    await customerService.addComment(id, content, user?.id ?? "", user?.name ?? "")
    if (customer) await loadActivity(customer, currentUserId)
  }

  const handleUpdateComment = async (commentName: string, content: string) => {
    await customerService.updateComment(commentName, content)
    if (customer) await loadActivity(customer, currentUserId)
  }

  const handleDeleteComment = async (commentName: string) => {
    await customerService.deleteComment(commentName)
    if (customer) await loadActivity(customer, currentUserId)
  }

  const handleDeleteCustomer = async () => {
    if (!id) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await customerService.delete(id)
      navigate("/customers")
    } catch (e) {
      if (e instanceof ApiError) {
        setDeleteError({ message: e.message, rawMessage: e.rawMessage })
      } else {
        setDeleteError({ message: e instanceof Error ? e.message : "Failed to delete customer", rawMessage: e instanceof Error ? e.message : "Failed to delete customer" })
      }
    } finally {
      setDeleting(false)
    }
  }

  const createActions = [
    { label: "Quotation", icon: FileText, href: (n: string) => `/quotations/new?customer=${n}` },
    { label: "Sales Order", icon: ShoppingCart, href: (n: string) => `/sales-orders/new?customer=${n}` },
    { label: "Payment Entry", icon: DollarSign, href: (n: string) => `/payments/new?party=Customer&party_name=${n}` },
    { label: "Opportunity", icon: TrendingUp, href: (n: string) => `/opportunities/new?customer=${n}` },
    { label: "Pricing Rule", icon: DollarSign, href: (n: string) => `/pricing-rules/new?customer=${n}` },
  ]

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
        </div>
      </>
    )
  }

  if (!customer) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center text-muted">Customer not found</div>
      </>
    )
  }

  const subtitle = [
    customer.customer_type,
    customer.customer_group,
    customer.territory,
    customer.creation ? `Customer since ${new Date(customer.creation).getFullYear()}` : "",
  ].filter(Boolean).join(" \u00b7 ") || "\u2014"

  return (
    <>
      <Topbar />
      <PageHead
        eyebrow="Customer"
        title={customer.customer_name}
        subtitle={subtitle}
        badge={
          <Badge variant={customer.status === "active" ? "success" : "default"} className="px-3 py-1 text-sm">
            {customer.status}
          </Badge>
        }
        backTo="/customers"
        actions={
          <>
            {/* Collapsible Assignments & Tags sidebar toggle (ERPNext form sidebar) */}
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

            {/* Create quick-action dropdown (pre-fills new docs via URL params) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="md">
                  Create <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {createActions.map((action) => (
                  <DropdownMenuItem key={action.label} onClick={() => navigate(action.href(customer.name))}>
                    <action.icon size={14} /> {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* AR & GL report quick-links (pre-filtered) */}
            <a
              href={`/api/method/frappe.desk.query_report.run?report_name=Accounts%20Receivable&filters=${encodeURIComponent(JSON.stringify({ customer: customer.name }))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-muted bg-surface border border-border rounded-[10px] hover:bg-gray-50 transition-colors"
            >
              <BarChart3 size={14} /> AR <ExternalLink size={12} />
            </a>
            <a
              href={`/api/method/frappe.desk.query_report.run?report_name=General%20Ledger&filters=${encodeURIComponent(JSON.stringify({ party: customer.name, party_type: "Customer" }))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-muted bg-surface border border-border rounded-[10px] hover:bg-gray-50 transition-colors"
            >
              <FileText size={14} /> GL <ExternalLink size={12} />
            </a>

            {/* Edit (ERPNext-style form page; kept for the /edit route) + Delete */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="More actions">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/customers/${customer.name}/edit`)}>
                  <Pencil size={14} /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowDeleteModal(true)}>
                  <Trash2 size={14} className="text-danger-600" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Primary action last, on the far right (ERPNext primary action placement).
                Customers are saved directly (no Submit/Amend), so Save/Update shows while dirty. */}
            {dirty && (
              <Button variant="primary" size="md" onClick={handleSave} loading={saving} data-testid="save_button">
                <Save size={16} /> Update
              </Button>
            )}
          </>
        }
      />
      <motion.div className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-start gap-6">
          {metaOpen && <CustomerMetaPanel name={customer.name} onCollapse={toggleMeta} />}
          <div className="flex-1 min-w-0 space-y-6">
            <div className="bg-white rounded-2xl shadow-card p-6">
              <CustomerForm
                ref={formRef}
                customer={customer}
                onSaved={fetchCustomer}
                onSavingChange={setSaving}
                onDirtyChange={setDirty}
              />
            </div>
            <PaymentActivity
              activity={activity}
              loading={activityLoading}
              onAddComment={handleAddComment}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      </motion.div>

      <Modal open={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeleteError(null) }} title="Delete Customer">
        {deleteError ? (
          <>
            <div className="rounded-lg border border-danger-200 bg-danger-50 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-100">
                  <XCircle size={14} className="text-danger-600" />
                </div>
                <div
                  className="text-sm text-danger-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: rewriteErpNextLinks(deleteError.rawMessage) }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeleteError(null) }}>Close</Button>
            </div>
          </>
        ) : (
          <>
            <p>Are you sure you want to delete <strong>{customer.customer_name}</strong>?</p>
            <p className="text-sm text-muted mt-2">This action cannot be undone. All linked contacts and addresses will be unlinked.</p>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
              <Button onClick={handleDeleteCustomer} loading={deleting} className="bg-danger-600 hover:bg-danger-700">Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}