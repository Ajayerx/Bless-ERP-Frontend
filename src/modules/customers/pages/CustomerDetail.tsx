"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Mail, MapPin, DollarSign, FileText, Pencil, Plus, CreditCard, Users, History, ExternalLink, ChevronDown, BarChart3, ShoppingCart, HelpCircle, TrendingUp } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge, Avatar, Skeleton, Button } from "@/components/ui"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui"
import { apiClient } from "@/services/api-client"
import { customerService, type CustomerDetail } from "@/modules/customers/services"
import { contactService, type Contact } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

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
  { key: "email_id", header: "Email", render: (c) => c.email_id || "�" },
  { key: "mobile_no", header: "Phone", render: (c) => c.mobile_no || c.phone || "�" },
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

function buildListUrl(
  doctype: string,
  params: {
    fields: string[]
    filters?: unknown[]
    limit_page_length?: number
    limit_start?: number
    order_by?: string
  }
): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent(doctype)}?${qp.toString()}`
}

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

  useEffect(() => {
    if (!id) return
    setLoading(true)
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
    ]).then(([c, invs, pays, conts]) => {
      setCustomer(c)
      setInvoices(invs)
      setPayments(pays)
      setContacts(conts)
      setLoading(false)
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
    { label: "Sales Order", icon: ShoppingCart, href: `/sales-orders/new?customer=${id}` },
    { label: "Payment Entry", icon: DollarSign, href: `/payments/new?party=Customer&party_name=${id}` },
    { label: "Opportunity", icon: TrendingUp, href: `/opportunities/new?customer=${id}` },
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
            <Button variant="secondary" size="sm" onClick={() => navigate(`/customers/${id}/edit`)}>
              <Pencil size={14} /> Edit
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
            <TabsTrigger value="addresses-contacts"><MapPin size={14} className="mr-1.5" /> Addresses &amp; Contacts</TabsTrigger>
            <TabsTrigger value="credit-limits"><CreditCard size={14} className="mr-1.5" /> Credit Limits</TabsTrigger>
            <TabsTrigger value="portal-users"><Users size={14} className="mr-1.5" /> Portal Users</TabsTrigger>
            <TabsTrigger value="transaction-history"><History size={14} className="mr-1.5" /> Transaction History</TabsTrigger>
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

            <div className="grid grid-cols-3 gap-4">
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
                        <div>
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
                  columns={contactCols}
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
    </>
  )
}