"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, ClipboardCheck, Warehouse as WarehouseIcon, AlertTriangle, CheckCircle2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { inventoryService } from "@/modules/inventory/services"
import type { StockCount } from "@/modules/inventory/types"
import { formatDate, cn } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" }> = {
  draft: { label: "Draft", variant: "default" },
  in_progress: { label: "In Progress", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
}

export default function StockCountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [count, setCount] = useState<StockCount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    inventoryService.getCount(id)
      .then(setCount)
      .finally(() => setLoading(false))
  }, [id])

  const handleUpdateStatus = async (status: StockCount["status"]) => {
    if (!id) return
    const updated = await inventoryService.updateCountStatus(id, status)
    setCount(updated)
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

  if (!count) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Stock count not found.</p>
          <Button className="mt-4" onClick={() => navigate("/inventory/counts")}>Back to Stock Counts</Button>
        </div>
      </>
    )
  }

  const discrepancies = count.items.filter((i) => i.difference !== 0)
  const totalExpected = count.items.reduce((s, i) => s + i.expectedQuantity, 0)
  const totalActual = count.items.reduce((s, i) => s + i.actualQuantity, 0)

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
            <button onClick={() => navigate("/inventory/counts")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{count.reference}</h1>
                <Badge variant={statusConfig[count.status]?.variant ?? "default"}>
                  {statusConfig[count.status]?.label ?? count.status}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">{count.warehouse} &middot; Created {formatDate(count.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {count.status === "draft" && (
              <>
                <Button variant="secondary" onClick={() => handleUpdateStatus("cancelled")}>Cancel</Button>
                <Button onClick={() => handleUpdateStatus("in_progress")}>Start Count</Button>
              </>
            )}
            {count.status === "in_progress" && (
              <Button onClick={() => handleUpdateStatus("completed")}>Complete Count</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-primary-600 bg-primary-50">
                <ClipboardCheck size={20} />
              </div>
              <div>
                <p className="text-sm text-muted">Items Counted</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{count.items.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-info-600 bg-info-50">
                <WarehouseIcon size={20} />
              </div>
              <div>
                <p className="text-sm text-muted">Expected Total</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{totalExpected}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-success-600 bg-success-50">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-sm text-muted">Actual Total</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{totalActual}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className={cn(
                "p-3 rounded-[10px]",
                discrepancies.length > 0 ? "text-danger-600 bg-danger-50" : "text-success-600 bg-success-50"
              )}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-sm text-muted">Discrepancies</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{discrepancies.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {count.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-body">{count.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Count Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Product</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">SKU</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Expected</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Actual</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {count.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-heading">{item.productName}</td>
                    <td className="px-5 py-3 text-sm text-muted">{item.sku}</td>
                    <td className="px-5 py-3 text-sm font-semibold tabular-nums text-right">{item.expectedQuantity}</td>
                    <td className="px-5 py-3 text-sm font-semibold tabular-nums text-right">{item.actualQuantity}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn(
                        "text-sm font-semibold tabular-nums",
                        item.difference === 0 ? "text-success-600" : "text-danger-600"
                      )}>
                        {item.difference > 0 ? "+" : ""}{item.difference}
                      </span>
                    </td>
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
