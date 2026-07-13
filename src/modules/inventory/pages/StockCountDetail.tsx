"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, ClipboardCheck, Warehouse as WarehouseIcon, DollarSign, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { inventoryService } from "@/modules/inventory/services"
import type { StockCount } from "@/modules/inventory/types"
import { formatDate, cn } from "@/lib/utils"

const statusConfig: Record<number, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" }> = {
  0: { label: "Draft", variant: "default" },
  1: { label: "Completed", variant: "success" },
  2: { label: "Cancelled", variant: "danger" },
}

export default function StockCountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [count, setCount] = useState<StockCount | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    const name = decodeURIComponent(id)
    inventoryService.getCount(name)
      .then(setCount)
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async () => {
    if (!count) return
    setActionLoading(true)
    try {
      await inventoryService.submitCount(count.name)
      const updated = await inventoryService.getCount(count.name)
      setCount(updated)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!count) return
    setActionLoading(true)
    try {
      await inventoryService.cancelCount(count.name)
      const updated = await inventoryService.getCount(count.name)
      setCount(updated)
    } finally {
      setActionLoading(false)
    }
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

  const totalExpected = count.items.reduce((s, i) => s + (i.current_qty ?? 0), 0)
  const totalActual = count.items.reduce((s, i) => s + i.qty, 0)
  const discrepancies = count.items.filter((i) => (i.quantity_difference ?? 0) !== 0)

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
                <h1 className="text-2xl font-bold text-heading">{count.name}</h1>
                <Badge variant={statusConfig[count.docstatus]?.variant ?? "default"}>
                  {statusConfig[count.docstatus]?.label ?? `Unknown (${count.docstatus})`}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">
                {count.set_warehouse ?? "All"} · {count.purpose} · Created {formatDate(count.creation)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {count.docstatus === 0 && (
              <Button onClick={handleSubmit} disabled={actionLoading}>
                <CheckCircle2 size={16} />
                {actionLoading ? "Submitting..." : "Complete Count"}
              </Button>
            )}
            {count.docstatus === 1 && (
              <Button variant="secondary" onClick={handleCancel} disabled={actionLoading}>
                <XCircle size={16} />
                {actionLoading ? "Cancelling..." : "Cancel"}
              </Button>
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
                <DollarSign size={20} />
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

        {count.difference_amount !== undefined && count.difference_amount !== 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Value Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn("text-lg font-bold", count.difference_amount > 0 ? "text-success-600" : "text-danger-600")}>
                {formatCurrency(count.difference_amount)}
              </p>
              <p className="text-sm text-muted mt-0.5">Stock value difference</p>
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
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Item</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Warehouse</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Expected</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Actual</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {count.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-heading">{item.item_code}</td>
                    <td className="px-5 py-3 text-sm text-muted">{item.warehouse}</td>
                    <td className="px-5 py-3 text-sm font-semibold tabular-nums text-right">{item.current_qty ?? "—"}</td>
                    <td className="px-5 py-3 text-sm font-semibold tabular-nums text-right">{item.qty}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn(
                        "text-sm font-semibold tabular-nums",
                        (item.quantity_difference ?? 0) === 0 ? "text-success-600" : "text-danger-600"
                      )}>
                        {(item.quantity_difference ?? 0) > 0 ? "+" : ""}{item.quantity_difference ?? "0"}
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(amount)
}
