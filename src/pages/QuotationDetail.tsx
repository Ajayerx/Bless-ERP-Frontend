"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, User, Calendar, AlertCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { quotationService, type Quotation } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" | "purple" }> = {
  draft: { label: "Draft", variant: "default" },
  sent: { label: "Sent", variant: "info" },
  accepted: { label: "Accepted", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  expired: { label: "Expired", variant: "warning" },
}

export default function QuotationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    quotationService.getById(id)
      .then(setQuotation)
      .finally(() => setLoading(false))
  }, [id])

  const handleUpdateStatus = async (status: Quotation["status"]) => {
    if (!id) return
    const updated = await quotationService.update(id, { status } as any)
    setQuotation(updated)
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Skeleton className="h-48 rounded-[16px]" />
            <Skeleton className="h-48 rounded-[16px]" />
          </div>
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!quotation) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Quotation not found.</p>
          <Button className="mt-4" onClick={() => navigate("/quotations")}>Back to Quotations</Button>
        </div>
      </>
    )
  }

  const isExpired = new Date(quotation.validUntil) < new Date() && quotation.status === "sent"

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
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/quotations")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{quotation.number}</h1>
                <Badge variant={statusConfig[quotation.status]?.variant ?? "default"}>
                  {statusConfig[quotation.status]?.label ?? quotation.status}
                </Badge>
                {isExpired && (
                  <Badge variant="warning">
                    <AlertCircle size={12} /> Expired
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted mt-0.5">Created {formatDate(quotation.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {quotation.status === "draft" && (
              <Button onClick={() => handleUpdateStatus("sent")}>Send Quotation</Button>
            )}
            {quotation.status === "sent" && !isExpired && (
              <>
                <Button variant="secondary" onClick={() => handleUpdateStatus("rejected")}>Reject</Button>
                <Button onClick={() => handleUpdateStatus("accepted")}>Accept</Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User size={16} className="text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-heading">{quotation.customerName}</p>
                  <p className="text-xs text-muted">{quotation.customerContact}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Bill To</p>
                <p className="text-sm text-body mt-1">{quotation.billTo}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-heading">{formatDate(quotation.issueDate)}</p>
                  <p className="text-xs text-muted">Issue Date</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle size={16} className={cn("mt-0.5 shrink-0", isExpired ? "text-danger-600" : "text-muted")} />
                <div>
                  <p className={cn("text-sm font-semibold", isExpired ? "text-danger-600" : "text-heading")}>
                    {formatDate(quotation.validUntil)}
                  </p>
                  <p className="text-xs text-muted">Valid Until</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {quotation.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-body">{quotation.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Item</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">SKU</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Qty</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Price</th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-muted/80">Tax</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {quotation.lineItems.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-heading">{item.productName}</td>
                    <td className="px-5 py-3 text-sm text-muted">{item.sku}</td>
                    <td className="px-5 py-3 text-sm font-semibold tabular-nums text-right">{item.quantity}</td>
                    <td className="px-5 py-3 text-sm text-right">{formatCurrency(item.price)}</td>
                    <td className="px-5 py-3 text-center">
                      <Badge variant="info" className="text-[10px]">{item.taxLabel} {item.taxRate * 100}%</Badge>
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold tabular-nums text-right">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Card className="w-72">
            <CardContent className="space-y-2 pt-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold text-heading tabular-nums">{formatCurrency(quotation.subtotal)}</span>
              </div>
              {quotation.gst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">GST (5%)</span>
                  <span className="text-body tabular-nums">{formatCurrency(quotation.gst)}</span>
                </div>
              )}
              {quotation.qst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">QST (9.975%)</span>
                  <span className="text-body tabular-nums">{formatCurrency(quotation.qst)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-base">
                <span className="font-bold text-heading">Total</span>
                <span className="font-bold text-heading tabular-nums">{formatCurrency(quotation.total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  )
}
