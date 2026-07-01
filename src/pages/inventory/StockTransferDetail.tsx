"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, MapPin } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { inventoryService } from "@/modules/inventory/services"
import type { StockTransfer } from "@/modules/inventory/types"
import { formatDate } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" }> = {
  draft: { label: "Draft", variant: "default" },
  in_transit: { label: "In Transit", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
}

export default function StockTransferDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [transfer, setTransfer] = useState<StockTransfer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    inventoryService.getTransfer(id)
      .then(setTransfer)
      .finally(() => setLoading(false))
  }, [id])

  const handleUpdateStatus = async (status: StockTransfer["status"]) => {
    if (!id) return
    const updated = await inventoryService.updateTransferStatus(id, status)
    setTransfer(updated)
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 rounded-[16px]" />
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!transfer) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Stock transfer not found.</p>
          <Button className="mt-4" onClick={() => navigate("/inventory/transfers")}>Back to Transfers</Button>
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
            <button onClick={() => navigate("/inventory/transfers")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{transfer.reference}</h1>
                <Badge variant={statusConfig[transfer.status]?.variant ?? "default"}>
                  {statusConfig[transfer.status]?.label ?? transfer.status}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">Created {formatDate(transfer.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {transfer.status === "draft" && (
              <>
                <Button variant="secondary" onClick={() => handleUpdateStatus("cancelled")}>Cancel</Button>
                <Button onClick={() => handleUpdateStatus("in_transit")}>Submit Transfer</Button>
              </>
            )}
            {transfer.status === "in_transit" && (
              <Button onClick={() => handleUpdateStatus("completed")}>Mark Completed</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Transfer Route</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-danger-50 text-danger-600">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">From</p>
                  <p className="text-sm font-semibold text-heading mt-0.5">{transfer.fromWarehouse}</p>
                </div>
              </div>
              <div className="border-l-2 border-dashed border-border ml-5 h-6" />
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-success-50 text-success-600">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">To</p>
                  <p className="text-sm font-semibold text-heading mt-0.5">{transfer.toWarehouse}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Reference" value={transfer.reference} />
              <Row label="Status" value={statusConfig[transfer.status]?.label ?? transfer.status} />
              <Row label="Items" value={String(transfer.items.length)} />
              <Row label="Created" value={formatDate(transfer.createdAt)} />
              {transfer.completedAt && <Row label="Completed" value={formatDate(transfer.completedAt)} />}
              {transfer.notes && <Row label="Notes" value={transfer.notes} />}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transfer Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Product</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">SKU</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Quantity</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {transfer.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-heading">{item.productName}</td>
                    <td className="px-5 py-3 text-sm text-muted">{item.sku}</td>
                    <td className="px-5 py-3 text-sm font-semibold tabular-nums text-right">{item.quantity}</td>
                    <td className="px-5 py-3 text-sm text-muted text-right">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-sm font-medium text-heading">{value}</p>
    </div>
  )
}
