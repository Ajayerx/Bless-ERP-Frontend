"use client"

import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, FileText, Pencil } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, Badge, Skeleton, Button } from "@/components/ui"
import { invoiceService, type Invoice } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"
import InvoicePDFButton from "@/modules/invoices/InvoicePDFButton"
import InvoiceLineItems from "@/modules/invoices/InvoiceLineItems"
import InvoiceTotals from "@/modules/invoices/InvoiceTotals"

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    invoiceService
      .getById(id)
      .then(setInvoice)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [id])

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

  const subtotal = invoice.subtotal ?? invoice.total / (1 + 0.05 + 0.09975)
  const gst = invoice.gst ?? subtotal * 0.05
  const qst = invoice.qst ?? subtotal * 0.09975

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
            to="/invoices"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors"
          >
            <ArrowLeft size={15} /> Back to Invoices
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate(`/invoices/${id}/edit`)}>
              <Pencil size={14} /> Edit
            </Button>
            <InvoicePDFButton />
          </div>
        </div>

        <Card className="max-w-3xl mx-auto">
          <CardContent>
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-[12px] bg-primary-50 text-primary-600 flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-heading">{invoice.number}</h1>
                    <p className="text-sm text-muted">{formatDate(invoice.issueDate)}</p>
                  </div>
                </div>
              </div>
              <Badge
                variant={
                  invoice.status === "paid"
                    ? "success"
                    : invoice.status === "overdue"
                      ? "danger"
                      : "warning"
                }
                className="px-3 py-1 text-sm"
              >
                {invoice.status?.toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Bill To
                </p>
                <p className="font-semibold text-heading">{invoice.customerName}</p>
                <p className="text-sm text-muted">{invoice.billTo}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Due Date
                </p>
                <p className="font-semibold text-heading">{formatDate(invoice.dueDate)}</p>
              </div>
            </div>

            <div className="mb-8">
              <InvoiceLineItems items={invoice.lineItems} readOnly />
            </div>

            <InvoiceTotals subtotal={subtotal} gst={gst} qst={qst} total={invoice.total} variant="inline" />
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
