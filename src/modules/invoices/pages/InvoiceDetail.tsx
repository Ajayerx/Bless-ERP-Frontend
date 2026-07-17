"use client"

import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, FileText, Pencil, CheckCircle2, XCircle, DollarSign, FileEdit } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, Badge, Skeleton, Button } from "@/components/ui"
import { invoiceService, type SalesInvoice, type SalesInvoiceItem, type SalesInvoiceTax } from "@/services"
import { formatDate, formatCurrency } from "@/lib/utils"
import InvoicePDFButton from "../components/InvoicePDFButton"
import InvoiceLineItems from "../components/InvoiceLineItems"
import InvoiceTotals from "../components/InvoiceTotals"

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
  const [error, setError] = useState("")

  const load = () => {
    if (!id) return
    setLoading(true)
    invoiceService.getById(id).then(setInvoice).catch(() => null).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

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

  // Dynamic tax extraction — iterate over all taxes, not just GST/QST
  const allTaxes = (invoice.taxes ?? []) as SalesInvoiceTax[]
  const totalTaxes = allTaxes.reduce((sum: number, t: SalesInvoiceTax) => sum + (t.tax_amount ?? 0), 0)
  const grandTotal = invoice.grand_total ?? netTotal + totalTaxes

  // Rounding from ERPNext (server-computed)
  const effectiveRoundedTotal = invoice.rounded_total ?? grandTotal
  const roundingAdjustment = effectiveRoundedTotal - grandTotal

  // Build tax lines for InvoiceTotals
  const taxLinesForDisplay = allTaxes.map((t: SalesInvoiceTax) => ({
    label: t.description || t.account_head || "Tax",
    amount: t.tax_amount ?? 0,
  }))

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
            {invoice.docstatus === 1 && (
              <Button variant="success" size="sm" disabled>
                <DollarSign size={14} /> Record Payment
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

        <Card>
          <CardContent>
            <div className="flex justify-between items-start mb-8">
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

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Bill To</p>
                <p className="font-semibold text-heading">{invoice.customer_name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Due Date</p>
                <p className="font-semibold text-heading">{formatDate(invoice.due_date)}</p>
              </div>
            </div>

            <div className="mb-8">
              <InvoiceLineItems items={readOnlyItems as any} readOnly />
            </div>

            <InvoiceTotals subtotal={netTotal} grandTotal={grandTotal} totalTaxesAndCharges={totalTaxes} taxLines={taxLinesForDisplay} roundingAdjustment={roundingAdjustment} roundedTotal={effectiveRoundedTotal} outstandingAmount={invoice.outstanding_amount} variant="inline" />

            {invoice.in_words && (
              <div className="flex justify-between text-sm mt-3 pt-3 border-t border-border/50">
                <span className="text-muted">In Words</span>
                <span className="text-heading italic">{invoice.in_words}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
