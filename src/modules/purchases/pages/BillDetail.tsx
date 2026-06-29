"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, User, Calendar, Hash, Printer, Send, Download } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable from "@/components/ui/DataTable"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { billService, type Bill } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

const statusVariant: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  paid: "success",
  pending: "info",
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

export default function BillDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [bill, setBill] = useState<Bill | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    billService.getById(id)
      .then(setBill)
      .finally(() => setLoading(false))
  }, [id])

  const handlePay = async () => {
    if (!bill) return
    setSubmitting(true)
    try {
      const updated = await billService.update(bill.id, { status: "paid" })
      setBill(updated)
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

  if (!bill) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Bill not found.</p>
          <Button className="mt-4" onClick={() => navigate("/purchases/bills")}>Back to Bills</Button>
        </div>
      </>
    )
  }

  const canPay = bill.status === "pending" || bill.status === "overdue"

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6 max-w-5xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/purchases/bills")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{bill.number}</h1>
                <Badge variant={statusVariant[bill.status] ?? "default"}>
                  {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">Created {formatDate(bill.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canPay && (
              <Button onClick={handlePay} loading={submitting}>
                <Send size={15} />
                Mark as Paid
              </Button>
            )}
            <Button variant="secondary">
              <Printer size={15} />
              PDF
            </Button>
            <Button variant="secondary">
              <Download size={15} />
              Download
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Bill From</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
                  <User size={16} />
                </div>
                <div>
                  <p className="font-semibold text-heading">{bill.vendorName}</p>
                  <p className="text-xs text-muted">{bill.billTo}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={14} className="text-muted shrink-0" />
                <div>
                  <p className="text-xs text-muted">Issue Date</p>
                  <p className="font-semibold text-heading">{formatDate(bill.issueDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={14} className="text-muted shrink-0" />
                <div>
                  <p className="text-xs text-muted">Due Date</p>
                  <p className={cn("font-semibold", bill.status === "overdue" ? "text-danger-600" : "text-heading")}>
                    {formatDate(bill.dueDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Hash size={14} className="text-muted shrink-0" />
                <div>
                  <p className="text-xs text-muted">Terms</p>
                  <p className="font-semibold text-heading">Net 30</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <DataTable
            columns={lineItemColumns}
            data={bill.lineItems}
            keyExtractor={(li) => li.id}
            pageSize={50}
          />
        </Card>

        <div className="flex justify-end">
          <Card className="w-72">
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold text-heading tabular-nums">{formatCurrency(bill.subtotal)}</span>
              </div>
              {bill.gst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">GST (5%)</span>
                  <span className="text-body tabular-nums">{formatCurrency(bill.gst)}</span>
                </div>
              )}
              {bill.qst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">QST (9.975%)</span>
                  <span className="text-body tabular-nums">{formatCurrency(bill.qst)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-base">
                <span className="font-bold text-heading">Total</span>
                <span className="font-bold text-heading tabular-nums">{formatCurrency(bill.total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {bill.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-body">{bill.notes}</p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </>
  )
}
