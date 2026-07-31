"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Mail, MapPin, DollarSign, FileText, Pencil, Plus, CreditCard, Users, History, ExternalLink, ChevronDown, BarChart3, ShoppingCart, HelpCircle, TrendingUp, Clock, MessageSquare, Send, StickyNote, XCircle, Trash2, Loader2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge, Avatar, Skeleton, Button, Textarea, Modal } from "@/components/ui"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui"
import { apiClient, ApiError } from "@/services/api-client"
import { customerService, noteService, buildListUrl, type CustomerDetail, type CustomerNote } from "@/modules/customers/services"
import { contactService, type Contact } from "@/services"
import { formatCurrency, formatDate, cn, rewriteErpNextLinks } from "@/lib/utils"

interface InvoiceRow {
  name: string
  customer: string
  grand_total: number
  outstanding_amount: number
  posting_date: string
  due_date: string
  status: string
  docstatus: number
}

interface PaymentRow {
  name: string
  posting_date: string
  payment_type: string
  paid_amount: number
  received_amount: number
  status: string
  docstatus: number
  mode_of_payment?: string
  reference_no?: string
}

interface TimelineItem {
  type: "Invoice" | "Payment"
  name: string
  date: string
  amount: number
  statusLabel: string
  statusVariant: "success" | "warning" | "danger" | "default"
  docstatus: number
  link: string
}

const invoiceColumns: Column<InvoiceRow>[] = [
  {
    key: "name", header: "Invoice",
    render: (inv) => (
      <Link to={`/invoices/${inv.name}`} className="font-semibold text-primary-600 hover:underline">
        {inv.name}
      </Link>
    ),
  },
  { key: "grand_total", header: "Amount", className: "text-right",
    render: (inv) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(inv.grand_total)}</span>,
  },
  { key: "posting_date", header: "Date", hideOnMobile: true,
    render: (inv) => <span className="text-sm text-muted">{formatDate(inv.posting_date)}</span>,
  },
  { key: "outstanding_amount", header: "Due", className: "text-right", hideOnMobile: true,
    render: (inv) => (
      <span className={cn("tabular-nums", inv.outstanding_amount > 0 ? "text-warning-600" : "text-muted")}>
        {inv.outstanding_amount > 0 ? formatCurrency(inv.outstanding_amount) : "�"}
      </span>
    ),
  },
  {
    key: "status", header: "Status",
    render: (inv) => {
      const variant = inv.docstatus === 1
        ? inv.outstanding_amount <= 0 ? "success" : "warning"
        : inv.docstatus === 0 ? "default" : "danger"
      const label = inv.docstatus === 1
        ? inv.outstanding_amount <= 0 ? "Paid" : inv.status
        : inv.docstatus === 0 ? "Draft" : "Cancelled"
      return <Badge variant={variant}>{label}</Badge>
    },
  },
]

const contactCols: Column<Contact>[] = [
  {
    key: "first_name", header: "Name",
    render: (c) => `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`,
  },
  { key: "email_id", header: "Email", render: (c) => c.email_id || "—" },
  { key: "mobile_no", header: "Phone", render: (c) => c.mobile_no || c.phone || "—" },
  { key: "is_primary_contact", header: "",
    render: (c) => c.is_primary_contact ? <Badge variant="success">Primary</Badge> : null,
  },
]

const timelineCols: Column<TimelineItem>[] = [
  {
    key: "type", header: "Type",
    render: (t) => <Badge variant={t.type === "Invoice" ? "info" : "default"}>{t.type}</Badge>,
  },
  {
    key: "name", header: "Reference",
    render: (t) => (
      <Link to={t.link} className="font-semibold text-primary-600 hover:underline">{t.name}</Link>
    ),
  },
  { key: "date", header: "Date",
    render: (t) => <span className="text-sm text-muted">{formatDate(t.date)}</span>,
  },
  { key: "amount", header: "Amount", className: "text-right",
    render: (t) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(t.amount)}</span>,
  },
  {
    key: "statusLabel", header: "Status",
    render: (t) => <Badge variant={t.statusVariant}>{t.statusLabel}</Badge>,
  },
]

function toTimelineItem(
  invOrPay: InvoiceRow | PaymentRow,
  type: "Invoice" | "Payment"
): TimelineItem {
  if (type === "Invoice") {
    const inv = invOrPay as InvoiceRow
    const isPaid = inv.docstatus === 1 && inv.outstanding_amount <= 0
    const isOverdue = inv.docstatus === 1 && inv.outstanding_amount > 0
    return {
      type: "Invoice",
      name: inv.name,
      date: inv.posting_date,
      amount: inv.grand_total,
      statusLabel: inv.docstatus === 1 ? (isPaid ? "Paid" : inv.status) : inv.docstatus === 0 ? "Draft" : "Cancelled",
      statusVariant: isPaid ? "success" : isOverdue ? "warning" : inv.docstatus === 0 ? "default" : "danger",
      docstatus: inv.docstatus,
      link: `/invoices/${inv.name}`,
    }
  }
  const pay = invOrPay as PaymentRow
  return {
    type: "Payment",
    name: pay.name,
    date: pay.posting_date,
    amount: pay.paid_amount,
    statusLabel: pay.docstatus === 1 ? "Submitted" : pay.docstatus === 0 ? "Draft" : "Cancelled",
    statusVariant: pay.docstatus === 1 ? "success" : pay.docstatus === 0 ? "default" : "danger",
    docstatus: pay.docstatus,
    link: `/payments/${pay.name}`,
  }
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("overview")
  const [createOpen, setCreateOpen] = useState(false)
  const createRef = useRef<HTMLDivElement>(null)
  const [notes, setNotes] = useState<CustomerNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [notesError, setNotesError] = useState("")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<{ message: string; rawMessage: string } | null>(null)
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null)
  const [deleteAddressError, setDeleteAddressError] = useState<string | null>(null)
  const [deletingContact, setDeletingContact] = useState<string | null>(null)
  const [deleteContactError, setDeleteContactError] = useState<string | null>(null)

  // Migrate old localStorage notes to ERPNext (one-time)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("blesserp_customer_notes")
      if (stored) {
        localStorage.removeItem("blesserp_customer_notes")
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!createOpen) return
    const handler = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [createOpen])

  const saveNote = async () => {
    if (!newNote.trim() || !id) return
    setSavingNote(true)
    setNotesError("")
    try {
      const note = await noteService.create(id, newNote.trim())
      setNotes((prev) => [note, ...prev])
      setNewNote("")
    } catch (e) {
      setNotesError(e instanceof Error ? e.message : "Failed to save note")
    }
    setSavingNote(false)
  }

  const deleteNote = async (noteId: string) => {
    if (!id) return
    setNotesError("")
    try {
      await noteService.delete(noteId)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (e) {
      setNotesError(e instanceof Error ? e.message : "Failed to delete note")
    }
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

  const handleDeleteAddress = async (addressName: string) => {
    if (!id) return
    setDeletingAddress(addressName)
    setDeleteAddressError(null)
    try {
      await customerService.deleteAddress(addressName)
      setCustomer((prev) => prev ? { ...prev, addresses: prev.addresses.filter((a) => a.name !== addressName) } : prev)
    } catch (e) {
      setDeleteAddressError(e instanceof Error ? e.message : "Failed to delete address")
    } finally {
      setDeletingAddress(null)
    }
  }

  const handleDeleteContact = async (contactName: string) => {
    if (!id) return
    setDeletingContact(contactName)
    setDeleteContactError(null)
    try {
      await customerService.deleteContact(contactName)
      setContacts((prev) => prev.filter((c) => c.name !== contactName))
    } catch (e) {
      setDeleteContactError(e instanceof Error ? e.message : "Failed to delete contact")
    } finally {
      setDeletingContact(null)
    }
  }

  const contactColsWithActions: Column<Contact>[] = [
    ...contactCols,
    {
      key: "name", header: "",
      render: (c) => (
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDeleteContact(c.name) }}
            disabled={deletingContact === c.name}
            className="text-muted hover:text-danger-600 transition-colors p-1 disabled:opacity-50"
          >
            {deletingContact === c.name ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
          {deleteContactError && deletingContact === null && (
            <span className="text-[11px] text-danger-600 max-w-[140px] text-right leading-tight">{deleteContactError}</span>
          )}
        </div>
      ),
    },
  ]

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotesLoading(true)
    Promise.all([
      customerService.getById(id).catch(() => null),
      apiClient<InvoiceRow[]>(
        buildListUrl("Sales Invoice", {
          fields: ["name", "customer", "grand_total", "outstanding_amount", "posting_date", "due_date", "status", "docstatus"],
          filters: [["customer", "=", id]],
          limit_page_length: 50,
          order_by: "posting_date desc",
        })
      ).catch(() => []),
      apiClient<PaymentRow[]>(
        buildListUrl("Payment Entry", {
          fields: ["name", "posting_date", "payment_type", "paid_amount", "received_amount", "status", "docstatus", "mode_of_payment", "reference_no"],
          filters: [["party_type", "=", "Customer"], ["party", "=", id]],
          limit_page_length: 50,
          order_by: "posting_date desc",
        })
      ).catch(() => []),
      contactService.list({ customerName: id, pageSize: 50 }).then((r) => r.items).catch(() => []),
      noteService.list(id).catch(() => []),
    ]).then(([c, invs, pays, conts, notesResult]) => {
      setCustomer(c)
      setInvoices(invs)
      setPayments(pays)
      setContacts(conts)
      setNotes(notesResult)
      setLoading(false)
      setNotesLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    )
  }

  if (!customer) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center text-muted py-24">Customer not found.</div>
      </>
    )
  }

  const totalInvoiced = invoices.reduce((s, inv) => s + inv.grand_total, 0)
  const totalDue = invoices.reduce((s, inv) => s + inv.outstanding_amount, 0)
  const totalPaid = totalInvoiced - totalDue
  const contactName = [customer.first_name, customer.last_name].filter(Boolean).join(" ")

  const timeline: TimelineItem[] = [
    ...invoices.map((inv) => toTimelineItem(inv, "Invoice")),
    ...payments.map((pay) => toTimelineItem(pay, "Payment")),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const billingAddr = customer.addresses.find((a) => a.address_type === "Billing")
  const counts = customer.transaction_counts

  const createActions = [
    { label: "Quotation", icon: FileText, href: `/quotations/new?customer=${id}` },
    { label: "Sales Order", icon: ShoppingCart, href: `/sales-orders/new?customer=${id}` },
    { label: "Payment Entry", icon: DollarSign, href: `/payments/new?party=Customer&party_name=${id}` },
    { label: "Opportunity", icon: TrendingUp, href: `/opportunities/new?customer=${id}` },
    { label: "Pricing Rule", icon: DollarSign, href: `/pricing-rules/new?customer=${id}` },
  ]

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors">
          <ArrowLeft size={15} /> Back to Customers
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={customer.customer_name} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-heading">{customer.customer_name}</h1>
              <p className="text-sm text-muted mt-0.5">
                {customer.customer_type} &middot; {customer.customer_group} &middot; {customer.territory}
                {customer.creation && <> &middot; Customer since {new Date(customer.creation).getFullYear()}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Action buttons */}
            <div className="relative" ref={createRef}>
              <Button variant="secondary" size="sm" onClick={() => setCreateOpen(!createOpen)} className="gap-1.5">
                Create <ChevronDown size={13} />
              </Button>
              {createOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-border rounded-[12px] shadow-lg py-1 z-50">
                  {createActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => { setCreateOpen(false); navigate(action.href) }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-body hover:bg-gray-50 transition-colors text-left"
                    >
                      <action.icon size={15} className="text-muted" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <a
              href={`/api/method/frappe.desk.query_report.run?report_name=Accounts%20Receivable&filters=${encodeURIComponent(JSON.stringify({customer: customer.name}))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-muted bg-surface border border-border rounded-[10px] hover:bg-gray-50 transition-colors"
            >
              <BarChart3 size={14} /> AR <ExternalLink size={12} />
            </a>
            <a
              href={`/api/method/frappe.desk.query_report.run?report_name=General%20Ledger&filters=${encodeURIComponent(JSON.stringify({party: customer.name, party_type: "Customer"}))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-muted bg-surface border border-border rounded-[10px] hover:bg-gray-50 transition-colors"
            >
              <FileText size={14} /> GL <ExternalLink size={12} />
            </a>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/customers/${id}/edit`)}>
              <Pencil size={14} /> Edit
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(true)} className="text-danger-600 border-danger-200 hover:bg-danger-50">
              <Trash2 size={14} /> Delete
            </Button>
            <Badge variant={customer.status === "active" ? "success" : "default"} className="px-3 py-1 text-sm">
              {customer.status}
            </Badge>
          </div>
        </div>

        {/* Transaction count cards */}
        {counts && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Sales Orders", value: counts.sales_orders, icon: ShoppingCart, color: "bg-blue-50 text-blue-600" },
              { label: "Invoices", value: counts.sales_invoices, icon: FileText, color: "bg-purple-50 text-purple-600" },
              { label: "Opportunities", value: counts.opportunities, icon: TrendingUp, color: "bg-green-50 text-green-600" },
              { label: "Issues", value: counts.issues, icon: HelpCircle, color: "bg-orange-50 text-orange-600" },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${item.color}`}>
                    <item.icon size={15} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-heading tabular-nums">{item.value}</p>
                    <p className="text-[11px] text-muted font-medium">{item.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview"><FileText size={14} className="mr-1.5" /> Overview</TabsTrigger>
            <TabsTrigger value="dashboard"><BarChart3 size={14} className="mr-1.5" /> Dashboard</TabsTrigger>
            <TabsTrigger value="activity"><Clock size={14} className="mr-1.5" /> Activity</TabsTrigger>
            <TabsTrigger value="notes"><StickyNote size={14} className="mr-1.5" /> Notes</TabsTrigger>
            <TabsTrigger value="addresses-contacts"><MapPin size={14} className="mr-1.5" /> Addresses &amp; Contacts</TabsTrigger>
            <TabsTrigger value="credit-limits"><CreditCard size={14} className="mr-1.5" /> Credit Limits</TabsTrigger>
            <TabsTrigger value="portal-users"><Users size={14} className="mr-1.5" /> Portal Users</TabsTrigger>
            <TabsTrigger value="transaction-history"><History size={14} className="mr-1.5" /> Transactions</TabsTrigger>
          </TabsList>

          {/* -- Overview -- */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><Mail size={16} /></div>
                    <div>
                      <p className="font-semibold text-heading">{contactName || "Contact"}</p>
                      <p className="text-xs text-muted">{customer.email_id || "�"}</p>
                      <p className="text-xs text-muted">{customer.mobile_no || "�"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-gray-100 text-muted flex items-center justify-center shrink-0"><MapPin size={16} /></div>
                    <div>
                      <p className="font-semibold text-heading">Billing Address</p>
                      <p className="text-xs text-muted">
                        {billingAddr ? (
                          <>
                            {billingAddr.address_line1}
                            {billingAddr.address_line2 ? <><br />{billingAddr.address_line2}</> : null}
                            <br />{[billingAddr.city, billingAddr.state].filter(Boolean).join(", ")}
                            {billingAddr.pincode || billingAddr.country ? <br /> : null}
                            {[billingAddr.pincode, billingAddr.country].filter(Boolean).join(" ")}
                          </>
                        ) : "�"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center shrink-0"><DollarSign size={16} /></div>
                    <div>
                      <p className="font-semibold text-heading">Outstanding</p>
                      <p className="text-lg font-bold text-heading tabular-nums">{formatCurrency(totalDue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="text-center">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Invoiced</p>
                  <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(totalInvoiced)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Paid</p>
                  <p className="text-xl font-bold text-success-600 mt-1 tabular-nums">{formatCurrency(totalPaid)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Due</p>
                  <p className="text-xl font-bold text-warning-600 mt-1 tabular-nums">{formatCurrency(totalDue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Invoices</p>
                  <p className="text-xl font-bold text-primary-600 mt-1 tabular-nums">{invoices.length}</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-lg font-bold text-heading mb-3">Invoices</h2>
              <DataTable
                columns={invoiceColumns} data={invoices} keyExtractor={(inv) => inv.name}
                emptyState={
                  <div className="flex flex-col items-center gap-2 py-4">
                    <FileText size={32} className="text-muted opacity-40" />
                    <p className="font-semibold text-body">No invoices yet</p>
                  </div>
                }
              />
            </div>
          </TabsContent>

          {/* -- Dashboard -- */}
          <TabsContent value="dashboard" className="space-y-6">
            <h2 className="text-lg font-bold text-heading">Transaction Dashboard</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: "Pre Sales", icon: TrendingUp, color: "bg-blue-50 text-blue-600", links: [
                  { label: "Opportunities", count: counts?.opportunities ?? 0, href: `/opportunities?customer=${id}` },
                  { label: "Quotations", count: counts?.quotations ?? 0, href: `/quotations?customer=${id}` },
                ]},
                { title: "Orders", icon: ShoppingCart, color: "bg-purple-50 text-purple-600", links: [
                  { label: "Sales Orders", count: counts?.sales_orders ?? 0, href: `/sales-orders?customer=${id}` },
                  { label: "Delivery Notes", count: counts?.delivery_notes ?? 0, href: `/inventory/transfers?customer=${id}` },
                  { label: "Sales Invoices", count: counts?.sales_invoices ?? 0, href: `/invoices?customer=${id}` },
                ]},
                { title: "Payments", icon: DollarSign, color: "bg-green-50 text-green-600", links: [
                  { label: "Payment Entries", count: counts?.payment_entries ?? 0, href: `/payments?customer=${id}` },
                  { label: "Bank Accounts", count: counts?.bank_accounts ?? 0, href: `/bank-accounts?customer=${id}` },
                  { label: "Dunnings", count: counts?.dunnings ?? 0, href: `/dunnings?customer=${id}` },
                ]},
                { title: "Support", icon: HelpCircle, color: "bg-orange-50 text-orange-600", links: [
                  { label: "Issues", count: counts?.issues ?? 0, href: `/issues?customer=${id}` },
                  { label: "Installation Notes", count: counts?.installation_notes ?? 0, href: `/installation-notes?customer=${id}` },
                  { label: "Warranty Claims", count: counts?.warranty_claims ?? 0, href: `/warranty-claims?customer=${id}` },
                ]},
              ].map((group) => (
                <Card key={group.title}>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center ${group.color}`}>
                        <group.icon size={16} />
                      </div>
                      <p className="font-semibold text-heading">{group.title}</p>
                    </div>
                    <div className="space-y-2">
                      {group.links.map((link) => (
                        <Link
                          key={link.label}
                          to={link.href}
                          className="flex items-center justify-between text-sm text-body hover:text-primary-600 transition-colors"
                        >
                          <span>{link.label}</span>
                          <Badge variant="default" className="tabular-nums">{link.count}</Badge>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {customer.credit_limits && customer.credit_limits.length > 0 && (
              <Card>
                <CardContent>
                  <h3 className="text-base font-bold text-heading mb-4">Credit Utilization</h3>
                  <div className="space-y-3">
                    {customer.credit_limits.map((cl, idx) => {
                      const companyOutstanding = invoices
                        .filter((inv) => inv.outstanding_amount > 0)
                        .reduce((s, inv) => s + inv.outstanding_amount, 0);
                      const pct = cl.credit_limit > 0 ? Math.min(100, (companyOutstanding / cl.credit_limit) * 100) : 0;
                      return (
                        <div key={cl.name ?? idx}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium text-body">{cl.company}</span>
                            <span className="text-muted tabular-nums">
                              {formatCurrency(companyOutstanding)} / {formatCurrency(cl.credit_limit)}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                pct >= 90 ? "bg-danger-500" : pct >= 70 ? "bg-warning-500" : "bg-success-500"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* -- Activity Timeline -- */}
          <TabsContent value="activity" className="space-y-4">
            <h2 className="text-lg font-bold text-heading">Activity Timeline</h2>
            {timeline.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <Clock size={40} className="text-muted opacity-40" />
                <p className="font-semibold text-body">No activity yet</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-4">
                  {timeline.slice(0, 20).map((item, idx) => (
                    <div key={`${item.type}-${item.name}-${idx}`} className="relative flex gap-4">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10",
                        item.type === "Invoice" ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"
                      )}>
                        {item.type === "Invoice" ? <FileText size={14} /> : <DollarSign size={14} />}
                      </div>
                      <div className="flex-1 bg-surface border border-border/50 rounded-[12px] p-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Link to={item.link} className="font-semibold text-heading hover:text-primary-600 transition-colors">
                              {item.name}
                            </Link>
                            <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
                          </div>
                          <span className="text-xs text-muted">{formatDate(item.date)}</span>
                        </div>
                        <p className="text-sm text-muted">
                          {item.type} &middot; <span className="font-medium text-heading tabular-nums">{formatCurrency(item.amount)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* -- Notes -- */}
          <TabsContent value="notes" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-heading">Notes</h2>
              <span className="text-sm text-muted">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
            </div>

            {notesError && (
              <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
                {notesError}
              </p>
            )}
            
            <Card>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Add a note about this customer..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveNote} disabled={!newNote.trim() || savingNote}>
                    <Send size={14} className="mr-1.5" /> {savingNote ? "Saving..." : "Add Note"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {notesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <MessageSquare size={40} className="text-muted opacity-40" />
                <p className="font-semibold text-body">No notes yet</p>
                <p className="text-sm text-muted">Add your first note above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <Card key={note.id}>
                    <CardContent>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-heading whitespace-pre-wrap">{note.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted">{note.author}</span>
                            <span className="text-xs text-muted">&middot;</span>
                            <span className="text-xs text-muted">{formatDate(note.createdAt)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteNote(note.id)}
                          className="text-muted hover:text-danger-600 transition-colors p-1"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* -- Addresses & Contacts -- */}
          <TabsContent value="addresses-contacts" className="space-y-6">
            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-heading">Addresses ({customer.addresses.length})</h3>
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/customers/${id}/edit`)}>
                    <Plus size={14} /> Add Address
                  </Button>
                </div>
                {customer.addresses.length === 0 ? (
                  <p className="text-sm text-muted">No addresses linked.</p>
                ) : (
                  <div className="space-y-3">
                    {customer.addresses.map((addr) => (
                      <div key={addr.name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-[12px]">
                        <MapPin size={16} className="text-muted mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-heading">
                            {addr.address_type}
                            {addr.name === customer.customer_primary_address && (
                              <Badge variant="success" className="ml-2 text-[10px] px-1.5 py-0">Primary</Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted">
                            {addr.address_line1}
                            {addr.address_line2 ? `, ${addr.address_line2}` : ""}
                            {addr.city ? `, ${addr.city}` : ""}
                            {addr.state ? `, ${addr.state}` : ""}
                            {addr.country}
                          </p>
                          {deleteAddressError && deletingAddress === null && (
                            <p className="text-xs text-danger-600 mt-1">{deleteAddressError}</p>
                          )}
                        </div>
                        <div className="flex items-start gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(addr.name)}
                            disabled={deletingAddress === addr.name}
                            className="text-muted hover:text-danger-600 transition-colors p-1 shrink-0 disabled:opacity-50"
                          >
                            {deletingAddress === addr.name ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-heading">Contacts ({contacts.length})</h3>
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/contacts/new?customer=${id}`)}>
                    <Plus size={14} /> Add Contact
                  </Button>
                </div>
                <DataTable
                  columns={contactColsWithActions}
                  data={contacts}
                  keyExtractor={(c) => c.name}
                  onRowClick={(c) => navigate(`/contacts/${c.name}`)}
                  emptyState={
                    <div className="flex flex-col items-center gap-2 py-4">
                      <p className="font-semibold text-body">No contacts linked.</p>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* -- Credit Limits -- */}
          <TabsContent value="credit-limits">
            <Card>
              <CardContent>
                <h3 className="text-base font-bold text-heading mb-4">Credit Limits</h3>
                {(customer.credit_limits ?? []).length === 0 ? (
                  <p className="text-sm text-muted">No credit limits configured.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-muted uppercase tracking-wider border-b border-border">
                        <th className="pb-3 pr-4">Company</th>
                        <th className="pb-3 pr-4 text-right">Credit Limit</th>
                        <th className="pb-3 text-center">Bypass Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(customer.credit_limits ?? []).map((cl, idx) => (
                        <tr key={cl.name ?? idx} className="border-b border-border/50">
                          <td className="py-3 pr-4 font-medium text-body">{cl.company}</td>
                          <td className="py-3 pr-4 text-right tabular-nums">{formatCurrency(cl.credit_limit)}</td>
                          <td className="py-3 text-center">
                            {cl.bypass_credit_limit_check ? <Badge variant="warning">Yes</Badge> : "�"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* -- Portal Users -- */}
          <TabsContent value="portal-users">
            <Card>
              <CardContent>
                <h3 className="text-base font-bold text-heading mb-4">Portal Users</h3>
                {(customer.portal_users ?? []).length === 0 ? (
                  <p className="text-sm text-muted">No portal users configured.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-muted uppercase tracking-wider border-b border-border">
                        <th className="pb-3">User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(customer.portal_users ?? []).map((pu, idx) => (
                        <tr key={pu.name ?? idx} className="border-b border-border/50">
                          <td className="py-3 font-medium text-body">{pu.user}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* -- Transaction History -- */}
          <TabsContent value="transaction-history">
            <div>
              <h2 className="text-lg font-bold text-heading mb-3">Transaction History</h2>
              <DataTable
                columns={timelineCols}
                data={timeline}
                keyExtractor={(t) => `${t.type}-${t.name}`}
                emptyState={
                  <div className="flex flex-col items-center gap-2 py-4">
                    <History size={32} className="text-muted opacity-40" />
                    <p className="font-semibold text-body">No transactions yet</p>
                  </div>
                }
              />
            </div>
          </TabsContent>
        </Tabs>
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