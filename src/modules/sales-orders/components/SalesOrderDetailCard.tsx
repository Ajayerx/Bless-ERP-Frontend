"use client"

import { ShoppingCart, Calendar, DollarSign, Package } from "lucide-react"
import { Card, CardContent } from "@/components/ui"
import { type SalesOrder } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"
import DataTable, { type Column } from "@/components/ui/DataTable"

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  draft: "warning",
  confirmed: "info",
  completed: "success",
  cancelled: "default",
}

const fulfillmentVariant: Record<string, "success" | "warning" | "info" | "danger"> = {
  fulfilled: "success",
  partial: "warning",
  pending: "info",
  cancelled: "danger",
}

import { Badge as UIBadge } from "@/components/ui"

const itemColumns: Column<{ productName: string; qty: number; rate: number; amount: number }>[] = [
  { key: "productName", header: "Product", render: (i) => <span className="font-medium text-heading">{i.productName}</span> },
  { key: "qty", header: "Qty", className: "text-right", render: (i) => <span className="tabular-nums">{i.qty}</span> },
  { key: "rate", header: "Rate", className: "text-right", render: (i) => <span className="tabular-nums">{formatCurrency(i.rate)}</span> },
  { key: "amount", header: "Amount", className: "text-right", render: (i) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(i.amount)}</span> },
]

interface SalesOrderDetailCardProps {
  salesOrder: SalesOrder
}

export default function SalesOrderDetailCard({ salesOrder }: SalesOrderDetailCardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-[12px] bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-heading">{salesOrder.number}</h1>
            <p className="text-sm text-muted">{salesOrder.customerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UIBadge variant={statusVariant[salesOrder.status] ?? "info"}>
            {salesOrder.status.charAt(0).toUpperCase() + salesOrder.status.slice(1)}
          </UIBadge>
          <UIBadge variant={fulfillmentVariant[salesOrder.fulfillmentStatus] ?? "info"}>
            {salesOrder.fulfillmentStatus.charAt(0).toUpperCase() + salesOrder.fulfillmentStatus.slice(1)}
          </UIBadge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <DollarSign size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(salesOrder.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Calendar size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Delivery Date</p>
                <p className="text-2xl font-bold text-heading mt-1">{formatDate(salesOrder.deliveryDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Package size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Items</p>
                <p className="text-2xl font-bold text-heading mt-1">{salesOrder.items.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <h3 className="font-bold text-heading">Line Items</h3>
          <DataTable
            columns={itemColumns}
            data={salesOrder.items}
            keyExtractor={(_, i) => String(i)}
            pageSize={50}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h3 className="font-bold text-heading">Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted">Issue Date</p>
              <p className="font-semibold text-heading">{formatDate(salesOrder.issueDate)}</p>
            </div>
            <div>
              <p className="text-muted">Customer</p>
              <p className="font-semibold text-heading">{salesOrder.customerName}</p>
            </div>
            <div>
              <p className="text-muted">Status</p>
              <p className="font-semibold text-heading capitalize">{salesOrder.status}</p>
            </div>
            <div>
              <p className="text-muted">Fulfillment</p>
              <p className="font-semibold text-heading capitalize">{salesOrder.fulfillmentStatus}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
