"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, User, Calendar, MapPin, Truck } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { salesOrderService, type SalesOrder } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" | "purple" }> = {
  pending: { label: "Pending", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "info" },
  shipped: { label: "Shipped", variant: "purple" },
  delivered: { label: "Delivered", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
}

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<SalesOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    salesOrderService.getById(id)
      .then(setOrder)
      .finally(() => setLoading(false))
  }, [id])

  const handleUpdateStatus = async (status: SalesOrder["status"]) => {
    if (!id) return
    const updated = await salesOrderService.update(id, { status } as any)
    setOrder(updated)
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

  if (!order) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Sales order not found.</p>
          <Button className="mt-4" onClick={() => navigate("/sales-orders")}>Back to Sales Orders</Button>
        </div>
      </>
    )
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
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/sales-orders")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{order.number}</h1>
                <Badge variant={statusConfig[order.status]?.variant ?? "default"}>
                  {statusConfig[order.status]?.label ?? order.status}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">Created {formatDate(order.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {order.status === "pending" && (
              <>
                <Button variant="secondary" onClick={() => handleUpdateStatus("cancelled")}>Cancel</Button>
                <Button onClick={() => handleUpdateStatus("confirmed")}>Confirm Order</Button>
              </>
            )}
            {order.status === "confirmed" && (
              <Button onClick={() => handleUpdateStatus("shipped")}>
                <Truck size={14} /> Mark Shipped
              </Button>
            )}
            {order.status === "shipped" && (
              <Button onClick={() => handleUpdateStatus("delivered")}>Mark Delivered</Button>
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
                  <p className="text-sm font-semibold text-heading">{order.customerName}</p>
                  <p className="text-xs text-muted">{order.customerContact}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Bill To</p>
                <p className="text-sm text-body mt-1">{order.billTo}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1">
                  <MapPin size={10} /> Ship To
                </p>
                <p className="text-sm text-body mt-1">{order.shippingAddress}</p>
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
                  <p className="text-sm font-semibold text-heading">{formatDate(order.issueDate)}</p>
                  <p className="text-xs text-muted">Order Date</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Truck size={16} className="text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-heading">{formatDate(order.deliveryDate)}</p>
                  <p className="text-xs text-muted">Delivery Date</p>
                </div>
              </div>
              {order.notes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Notes</p>
                  <p className="text-sm text-body mt-1">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
                {order.lineItems.map((item, idx) => (
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
                <span className="font-semibold text-heading tabular-nums">{formatCurrency(order.subtotal)}</span>
              </div>
              {order.gst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">GST (5%)</span>
                  <span className="text-body tabular-nums">{formatCurrency(order.gst)}</span>
                </div>
              )}
              {order.qst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">QST (9.975%)</span>
                  <span className="text-body tabular-nums">{formatCurrency(order.qst)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-base">
                <span className="font-bold text-heading">Total</span>
                <span className="font-bold text-heading tabular-nums">{formatCurrency(order.total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  )
}
