"use client"

import { ShoppingCart, Calendar, DollarSign, Truck } from "lucide-react"
import { Card, CardContent, Badge } from "@/components/ui"
import { type PurchaseOrder } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

const statusVariant: Record<string, "warning" | "info" | "success" | "default"> = {
  draft: "warning",
  sent: "info",
  received: "success",
  cancelled: "default",
}

interface PurchaseDetailCardProps {
  purchaseOrder: PurchaseOrder
}

export default function PurchaseDetailCard({ purchaseOrder }: PurchaseDetailCardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-[12px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-heading">{purchaseOrder.number}</h1>
            <p className="text-sm text-muted">{purchaseOrder.supplierName}</p>
          </div>
        </div>
        <Badge variant={statusVariant[purchaseOrder.status] ?? "info"}>
          {purchaseOrder.status.charAt(0).toUpperCase() + purchaseOrder.status.slice(1)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <DollarSign size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(purchaseOrder.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Calendar size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Order Date</p>
                <p className="text-2xl font-bold text-heading mt-1">{formatDate(purchaseOrder.orderDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Truck size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Expected</p>
                <p className="text-2xl font-bold text-heading mt-1">{formatDate(purchaseOrder.expectedDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <h3 className="font-bold text-heading">Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted">Supplier</p>
              <p className="font-semibold text-heading">{purchaseOrder.supplierName}</p>
            </div>
            <div>
              <p className="text-muted">Status</p>
              <p className="font-semibold text-heading capitalize">{purchaseOrder.status}</p>
            </div>
            <div>
              <p className="text-muted">Created</p>
              <p className="font-semibold text-heading">{formatDate(purchaseOrder.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
