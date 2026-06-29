"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Mail,
  Printer,
  Send,
  Download,
  User,
  Calendar,
  Hash,
} from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable from "@/components/ui/DataTable"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { invoiceService, type Invoice } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

const statusVariant: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  paid: "success",
  sent: "info",
  draft: "warning",
  overdue: "danger",
  cancelled: "default",
}

const lineItemColumns = [
  {
    key: "productName",
    header: "Item",
    render: (li: any) => (
      <div>
        <p className="font-semibold text-heading text-sm">{li.productName}</p>
        <p className="text-xs text-muted">SKU: {li.sku}</p>
      </div>
    ),
  },
  { key: "quantity", header: "Qty", className: "text-right", render: (li: any) => (
    <span className="text-sm text-body tabular-nums">{li.quantity}</span>
  )},
  { key: "price", header: "Price", className: "text-right", render: (li: any) => (
    <span className="text-sm text-body tabular-nums">{formatCurrency(li.price)}</span>
  )},
  { key: "taxLabel", header: "Tax", className: "text-center", render: (li: any) => (
    <Badge variant="default" className="text-[11px] px-2 py-0.5">{li.taxLabel} {(li.taxRate * 100).toFixed(1)}%</Badge>
  )},
  { key: "total", header: "Total", className: "text-right", render: (li: any) => (
    <span className="font-semibold text-heading text-sm tabular-nums">{formatCurrency(li.total)}</span>
  )},
]

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    invoiceService.getById(id)
      .then(setInvoice)
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async () => {
    if (!invoice) return
    setSubmitting(true)
    try {
      const updated = await invoiceService.update(invoice.id, { status: "sent" } as any)
      setInvoice(updated as Invoice)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Skeleton className="h-40 rounded-[16px] lg:col-span-2" />
            <Skeleton className="h-40 rounded-[16px]" />
          </div>
          <Skeleton className="h-64 rounded-[16px]" />
          <Skeleton className="h-32 w-72 rounded-[16px] ml-auto" />
        </div>
      </>
    )
  }

  if (!invoice) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Invoice not found.</p>
          <Button className="mt-4" onClick={() => navigate("/invoices")}>Back to Invoices</Button>
        </div>
      </>
    )
  }

  const isDraft = invoice.status === "draft"

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6 max-w-5xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/invoices")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{invoice.number}</h1>
                <Badge variant={statusVariant[invoice.status] ?? "default"}>
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">Created {formatDate(invoice.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDraft && (
              <Button onClick={handleSubmit} loading={submitting}>
                <Send size={15} />
                Submit
              </Button>
            )}
            <Button variant="secondary">
              <Printer size={15} />
              PDF
            </Button>
            <Button variant="secondary">
              <Mail size={15} />
              Email
            </Button>
            {!isDraft && (
              <Button variant="secondary">
                <Download size={15} />
                Download
              </Button>
            )}
          </div>
        </div>

        {/* Invoice Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Customer Info */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Bill To</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
                  <User size={16} />
                </div>
                <div>
                  <p className="font-semibold text-heading">{invoice.customerName}</p>
                  <p className="text-xs text-muted">{invoice.billTo}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dates & Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={14} className="text-muted shrink-0" />
                <div>
                  <p className="text-xs text-muted">Issue Date</p>
                  <p className="font-semibold text-heading">{formatDate(invoice.issueDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={14} className="text-muted shrink-0" />
                <div>
                  <p className="text-xs text-muted">Due Date</p>
                  <p className={cn("font-semibold", invoice.status === "overdue" ? "text-danger-600" : "text-heading")}>
                    {formatDate(invoice.dueDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Hash size={14} className="text-muted shrink-0" />
                <div>
                  <p className="text-xs text-muted">Payment Terms</p>
                  <p className="font-semibold text-heading">Net 30</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card className="p-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <DataTable
            columns={lineItemColumns}
            data={invoice.lineItems}
            keyExtractor={(li) => li.id}
            pageSize={50}
          />
        </Card>

        {/* Summary */}
        <div className="flex justify-end">
          <Card className="w-72">
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold text-heading tabular-nums">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.gst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">GST (5%)</span>
                  <span className="text-body tabular-nums">{formatCurrency(invoice.gst)}</span>
                </div>
              )}
              {invoice.qst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">QST (9.975%)</span>
                  <span className="text-body tabular-nums">{formatCurrency(invoice.qst)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-base">
                <span className="font-bold text-heading">Total</span>
                <span className="font-bold text-heading tabular-nums">{formatCurrency(invoice.total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  )
}
