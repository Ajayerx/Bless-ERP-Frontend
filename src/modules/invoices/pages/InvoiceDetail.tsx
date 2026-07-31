"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, FileText, Pencil, CheckCircle2, XCircle, DollarSign, FileEdit, MapPin, Phone, Mail, User, Plus, ChevronDown, Trash2, Receipt, AlertTriangle, ExternalLink } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, Badge, Skeleton, Button, CollapsibleSection } from "@/components/ui"
import { invoiceService, paymentService, type SalesInvoice, type SalesInvoiceItem, type SalesInvoiceTax } from "@/services"
import { formatDate, formatCurrency } from "@/lib/utils"
import InvoicePDFButton from "../components/InvoicePDFButton"
import InvoiceLineItems from "../components/InvoiceLineItems"
import InvoiceTotals from "../components/InvoiceTotals"
import RecordPaymentDialog from "../components/RecordPaymentDialog"

const statusVariant: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  Paid: "success",
  Unpaid: "warning",
  Draft: "default",
  Overdue: "danger",
  Cancelled: "default",
  Submitted: "info",
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("main")
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false)
  const [linkedDocs, setLinkedDocs] = useState<Record<string, Array<{ name: string; docstatus: number }>> | null>(null)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    invoiceService.getById(id).then(setInvoice).catch(() => null).finally(() => setLoading(false))
    invoiceService.getLinkedDocs("Sales Invoice", id).then(setLinkedDocs).catch(() => null)
  }, [id])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!id) return
    setSubmitting(true)
    setError("")
    try {
      await invoiceService.submit(id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit invoice")
    } finally { setSubmitting(false) }
  }

  const handleCancel = async () => {
    if (!id) return
    setSubmitting(true)
    setError("")
    try {
      await invoiceService.cancel(id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel invoice")
    } finally { setSubmitting(false) }
  }

  const handleAmend = async () => {
    if (!id) return
    setSubmitting(true)
    setError("")
    try {
      const amended = await invoiceService.amend(id)
      navigate(`/invoices/${amended.name}/edit`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to amend invoice")
    } finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!window.confirm("Delete this invoice? This action cannot be undone.")) return
    setDeleting(true)
    setError("")
    try {
      await invoiceService.delete(id)
      navigate("/invoices")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete invoice")
    } finally { setDeleting(false) }
  }

  const handleCreateAction = async (action: () => Promise<{ doctype: string; name: string }>) => {
    if (!id) return
    setSubmitting(true)
    setCreateDropdownOpen(false)
    try {
      const result = await action()
      navigate(`/${result.doctype.toLowerCase().replace(/\s+/g, "-")}/${result.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally { setSubmitting(false) }
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

  if (!invoice) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center text-muted py-24">Invoice not found.</div>
      </>
    )
  }

  const readOnlyItems = (invoice.items ?? []).map((item: SalesInvoiceItem) => ({
    id: item.name ?? item.item_code,
    productName: item.item_name || item.item_code,
    description: item.description || undefined,
    quantity: item.qty,
    price: item.rate,
    total: item.amount ?? (item.qty * item.rate),
  }))

  const netTotal = invoice.net_total ?? readOnlyItems.reduce((s: number, i: { total: number }) => s + i.total, 0)
  const allTaxes = (invoice.taxes ?? []) as SalesInvoiceTax[]
  const totalTaxes = allTaxes.reduce((sum: number, t: SalesInvoiceTax) => sum + (t.tax_amount ?? 0), 0)
  const grandTotal = invoice.grand_total ?? netTotal + totalTaxes
  const effectiveRoundedTotal = invoice.rounded_total ?? grandTotal
  const roundingAdjustment = effectiveRoundedTotal - grandTotal
  const taxLinesForDisplay = allTaxes.map((t: SalesInvoiceTax) => ({
    label: t.description || t.account_head || "Tax",
    amount: t.tax_amount ?? 0,
  }))

  const canCreatePayment = invoice.docstatus === 1 && (invoice.outstanding_amount ?? 0) !== 0
  const canCreateReturn = invoice.docstatus === 1 && !invoice.is_return
  const canCreateDeliveryNote = invoice.docstatus === 1 && !invoice.is_return && !invoice.update_stock
  const canCreatePaymentRequest = invoice.docstatus === 1 && (invoice.outstanding_amount ?? 0) > 0
  const canCreateInvoiceDiscounting = invoice.docstatus === 1 && (invoice.outstanding_amount ?? 0) > 0
  const canCreateDunning = invoice.docstatus === 1 && (invoice.outstanding_amount ?? 0) > 0
  const canCreateInterCompanyPI = invoice.docstatus === 1 && !!invoice.is_internal_customer
  const canCreateMaintenanceSchedule = invoice.docstatus === 1
  const canDelete = invoice.docstatus === 0

  const tabs = [
    { id: "main", label: "Main" },
    { id: "addressContact", label: "Address & Contact" },
    { id: "terms", label: "Terms" },
    { id: "moreInfo", label: "More Info" },
    { id: "linked", label: "Linked" },
  ]

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-[14px] text-sm text-red-700">
            {error}
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
            {/* Create dropdown (ERPNext style) */}
            {(canCreatePayment || canCreateReturn || canCreateDeliveryNote || canCreatePaymentRequest || canCreateInvoiceDiscounting || canCreateDunning || canCreateInterCompanyPI || canCreateMaintenanceSchedule) && (
              <div className="relative">
                <Button
                  size="sm"
                  onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
                  className="flex items-center gap-1"
                >
                  <Plus size={14} /> Create <ChevronDown size={12} />
                </Button>
                {createDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCreateDropdownOpen(false)} />
                    <div className="absolute right-0 mt-1 z-20 w-56 bg-white border border-border rounded-lg shadow-xl py-1">
                      {canCreatePayment && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makePaymentEntry(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <DollarSign size={14} /> Payment
                        </button>
                      )}
                      {canCreateReturn && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeSalesReturn(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FileText size={14} /> Return / Credit Note
                        </button>
                      )}
                      {canCreateDeliveryNote && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeDeliveryNote(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FileEdit size={14} /> Delivery Note
                        </button>
                      )}
                      {canCreatePaymentRequest && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makePaymentRequest(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <DollarSign size={14} /> Payment Request
                        </button>
                      )}
                      {canCreateInvoiceDiscounting && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeInvoiceDiscounting(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Receipt size={14} /> Invoice Discounting
                        </button>
                      )}
                      {canCreateDunning && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeDunning(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <AlertTriangle size={14} /> Dunning
                        </button>
                      )}
                      {canCreateInterCompanyPI && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeInterCompanyPurchaseInvoice(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FileText size={14} /> Inter-Company Purchase Invoice
                        </button>
                      )}
                      {canCreateMaintenanceSchedule && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeMaintenanceSchedule(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FileText size={14} /> Maintenance Schedule
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            {invoice.docstatus === 0 && (
              <Button size="sm" onClick={handleSubmit} loading={submitting}>
                <CheckCircle2 size={14} /> Submit
              </Button>
            )}
            {invoice.docstatus === 0 && (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/invoices/${id}/edit`)}>
                <Pencil size={14} /> Edit
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
                <Trash2 size={14} /> Delete
              </Button>
            )}
            {invoice.docstatus === 1 && (
              <Button variant="danger" size="sm" onClick={handleCancel} loading={submitting}>
                <XCircle size={14} /> Cancel
              </Button>
            )}
            {invoice.docstatus === 2 && (
              <Button variant="secondary" size="sm" onClick={handleAmend} loading={submitting}>
                <FileEdit size={14} /> Amend
              </Button>
            )}
            <InvoicePDFButton invoice={invoice} />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-muted hover:text-body"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ==================== MAIN TAB ==================== */}
        {activeTab === "main" && (
          <Card>
            <CardContent>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-[12px] bg-primary-50 text-primary-600 flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-heading">{invoice.name}</h1>
                      <p className="text-sm text-muted">{formatDate(invoice.posting_date)}</p>
                    </div>
                  </div>
                </div>
                <Badge variant={statusVariant[invoice.status] ?? "default"} className="px-3 py-1 text-sm">
                  {invoice.status?.toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-6">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Bill To</p>
                  <p className="font-semibold text-heading">{invoice.customer_name}</p>
                  {invoice.tax_id && <p className="text-xs text-muted mt-0.5">Tax ID: {invoice.tax_id}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Due Date</p>
                  <p className="font-semibold text-heading">{formatDate(invoice.due_date)}</p>
                </div>
              </div>

              {/* Items */}
              <div className="mb-6">
                <InvoiceLineItems items={readOnlyItems as any} readOnly />
              </div>

              {/* Payment Schedule */}
              {invoice.payment_schedule && invoice.payment_schedule.length > 0 && (
                <CollapsibleSection title="Payment Schedule" defaultOpen>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-semibold text-muted uppercase tracking-wider pb-2">Due Date</th>
                        <th className="text-right text-xs font-semibold text-muted uppercase tracking-wider pb-2">Amount</th>
                        <th className="text-right text-xs font-semibold text-muted uppercase tracking-wider pb-2">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.payment_schedule.map((ps, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 text-body">{formatDate(ps.due_date)}</td>
                          <td className="py-2 text-body text-right tabular-nums">{formatCurrency(ps.payment_amount)}</td>
                          <td className="py-2 text-body text-right tabular-nums">{formatCurrency(ps.outstanding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CollapsibleSection>
              )}

              {/* Sales Team */}
              {invoice.sales_team && invoice.sales_team.length > 0 && (
                <CollapsibleSection title="Sales Team" defaultOpen>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-semibold text-muted uppercase tracking-wider pb-2">Sales Person</th>
                        <th className="text-right text-xs font-semibold text-muted uppercase tracking-wider pb-2">Contrib.</th>
                        <th className="text-right text-xs font-semibold text-muted uppercase tracking-wider pb-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.sales_team.map((st, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 text-body">{st.sales_person}</td>
                          <td className="py-2 text-body text-right">{st.allocated_percentage != null ? `${st.allocated_percentage}%` : ""}</td>
                          <td className="py-2 text-body text-right tabular-nums">{st.allocated_amount != null ? formatCurrency(st.allocated_amount) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CollapsibleSection>
              )}

              {/* Totals */}
              <InvoiceTotals subtotal={netTotal} grandTotal={grandTotal} totalTaxesAndCharges={totalTaxes} taxLines={taxLinesForDisplay} roundingAdjustment={roundingAdjustment} roundedTotal={effectiveRoundedTotal} outstandingAmount={invoice.outstanding_amount} variant="inline" />

              {invoice.in_words && (
                <div className="flex justify-between text-sm mt-3 pt-3 border-t border-border/50">
                  <span className="text-muted">In Words</span>
                  <span className="text-heading italic">{invoice.in_words}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ==================== ADDRESS & CONTACT TAB ==================== */}
        {activeTab === "addressContact" && (
          <Card>
            <CardContent>
              {(invoice.address_display || invoice.shipping_address || invoice.contact_display || invoice.contact_email || invoice.contact_mobile) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {invoice.address_display && (
                    <div className="flex gap-3">
                      <MapPin size={16} className="text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Billing Address</p>
                        <p className="text-sm text-body whitespace-pre-wrap">{invoice.address_display?.replace(/<br\s*\/?>/gi, "\n")}</p>
                      </div>
                    </div>
                  )}
                  {invoice.shipping_address && (
                    <div className="flex gap-3">
                      <MapPin size={16} className="text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Shipping Address</p>
                        <p className="text-sm text-body whitespace-pre-wrap">{invoice.shipping_address?.replace(/<br\s*\/?>/gi, "\n")}</p>
                      </div>
                    </div>
                  )}
                  {invoice.contact_display && (
                    <div className="flex gap-3">
                      <User size={16} className="text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Contact</p>
                        <p className="text-sm text-body">{invoice.contact_display}</p>
                      </div>
                    </div>
                  )}
                  {invoice.contact_email && (
                    <div className="flex gap-3">
                      <Mail size={16} className="text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Email</p>
                        <p className="text-sm text-body">{invoice.contact_email}</p>
                      </div>
                    </div>
                  )}
                  {invoice.contact_mobile && (
                    <div className="flex gap-3">
                      <Phone size={16} className="text-muted mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Mobile</p>
                        <p className="text-sm text-body">{invoice.contact_mobile}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ==================== TERMS TAB ==================== */}
        {activeTab === "terms" && (
          <Card>
            <CardContent>
              {/* Payment Schedule */}
              {invoice.payment_schedule && invoice.payment_schedule.length > 0 && (
                <CollapsibleSection title="Payment Schedule" defaultOpen>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-semibold text-muted uppercase tracking-wider pb-2">Due Date</th>
                        <th className="text-right text-xs font-semibold text-muted uppercase tracking-wider pb-2">Amount</th>
                        <th className="text-right text-xs font-semibold text-muted uppercase tracking-wider pb-2">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.payment_schedule.map((ps, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 text-body">{formatDate(ps.due_date)}</td>
                          <td className="py-2 text-body text-right tabular-nums">{formatCurrency(ps.payment_amount)}</td>
                          <td className="py-2 text-body text-right tabular-nums">{formatCurrency(ps.outstanding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CollapsibleSection>
              )}

              {/* Terms and Conditions */}
              {(invoice.tc_name || invoice.terms) && (
                <CollapsibleSection title="Terms and Conditions">
                  {invoice.tc_name && (
                    <p className="text-xs text-muted mb-1">Template: {invoice.tc_name}</p>
                  )}
                  {invoice.terms && (
                    <div className="text-sm text-body whitespace-pre-wrap bg-gray-50 rounded-[10px] p-4 border border-border/50">
                      {invoice.terms}
                    </div>
                  )}
                </CollapsibleSection>
              )}
            </CardContent>
          </Card>
        )}

        {/* ==================== LINKED TAB ==================== */}
        {activeTab === "linked" && (
          <Card>
            <CardContent>
              {!linkedDocs ? (
                <p className="text-sm text-muted">Loading...</p>
              ) : Object.keys(linkedDocs).length === 0 ? (
                <p className="text-sm text-muted">No linked documents.</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(linkedDocs).map(([doctype, docs]) => (
                    <CollapsibleSection key={doctype} title={`${doctype} (${docs.length})`} defaultOpen>
                      <div className="space-y-1">
                        {docs.map((doc) => (
                          <Link
                            key={doc.name}
                            to={`/${doctype.toLowerCase().replace(/\s+/g, "-")}/${doc.name}`}
                            className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                          >
                            <span className="text-sm text-body font-medium">{doc.name}</span>
                            <span className="flex items-center gap-2">
                              <Badge
                                variant={doc.docstatus === 1 ? "success" : doc.docstatus === 2 ? "default" : "warning"}
                                className="text-[10px] px-2 py-0.5"
                              >
                                {doc.docstatus === 1 ? "Submitted" : doc.docstatus === 2 ? "Cancelled" : "Draft"}
                              </Badge>
                              <ExternalLink size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                          </Link>
                        ))}
                      </div>
                    </CollapsibleSection>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ==================== MORE INFO TAB ==================== */}
        {activeTab === "moreInfo" && (
          <Card>
            <CardContent>
              {/* More Information */}
              {(invoice.po_no || invoice.po_date || invoice.tax_category || invoice.customer_group || invoice.currency || invoice.selling_price_list || invoice.total_net_weight != null) && (
                <CollapsibleSection title="More Information">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {invoice.po_no && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Customer PO No.</p>
                        <p className="text-sm text-body">{invoice.po_no}</p>
                      </div>
                    )}
                    {invoice.po_date && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">PO Date</p>
                        <p className="text-sm text-body">{formatDate(invoice.po_date)}</p>
                      </div>
                    )}
                    {invoice.tax_category && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Tax Category</p>
                        <p className="text-sm text-body">{invoice.tax_category}</p>
                      </div>
                    )}
                    {invoice.customer_group && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Customer Group</p>
                        <p className="text-sm text-body">{invoice.customer_group}</p>
                      </div>
                    )}
                    {invoice.currency && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Currency</p>
                        <p className="text-sm text-body">{invoice.currency}</p>
                      </div>
                    )}
                    {invoice.selling_price_list && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Price List</p>
                        <p className="text-sm text-body">{invoice.selling_price_list}</p>
                      </div>
                    )}
                    {invoice.total_net_weight != null && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Total Net Weight</p>
                        <p className="text-sm text-body">{invoice.total_net_weight}</p>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Accounting Details */}
              {(invoice.debit_to || invoice.cost_center || invoice.project || invoice.is_opening || invoice.remarks) && (
                <CollapsibleSection title="Accounting Details">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {invoice.debit_to && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Debit To</p>
                        <p className="text-sm text-body">{invoice.debit_to}</p>
                      </div>
                    )}
                    {invoice.cost_center && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Cost Center</p>
                        <p className="text-sm text-body">{invoice.cost_center}</p>
                      </div>
                    )}
                    {invoice.project && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Project</p>
                        <p className="text-sm text-body">{invoice.project}</p>
                      </div>
                    )}
                    {invoice.is_opening && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Is Opening Entry</p>
                        <p className="text-sm text-body">{invoice.is_opening}</p>
                      </div>
                    )}
                    {invoice.remarks && (
                      <div className="col-span-full">
                        <p className="text-xs font-semibold text-muted mb-0.5">Remarks</p>
                        <p className="text-sm text-body whitespace-pre-wrap">{invoice.remarks}</p>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Loyalty Points */}
              {!!(invoice.redeem_loyalty_points && invoice.loyalty_program) && (
                <CollapsibleSection title="Loyalty Points">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-muted mb-0.5">Loyalty Program</p>
                      <p className="text-sm text-body">{invoice.loyalty_program}</p>
                    </div>
                    {invoice.loyalty_points != null && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Points</p>
                        <p className="text-sm text-body">{invoice.loyalty_points}</p>
                      </div>
                    )}
                    {invoice.loyalty_amount != null && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Amount</p>
                        <p className="text-sm text-body">{formatCurrency(invoice.loyalty_amount)}</p>
                      </div>
                    )}
                    {invoice.loyalty_redemption_account && (
                      <div>
                        <p className="text-xs font-semibold text-muted mb-0.5">Redemption Account</p>
                        <p className="text-sm text-body">{invoice.loyalty_redemption_account}</p>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}
            </CardContent>
          </Card>
        )}

        <RecordPaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          invoice={invoice}
          onPaymentComplete={load}
        />
      </motion.div>
    </>
  )
}
