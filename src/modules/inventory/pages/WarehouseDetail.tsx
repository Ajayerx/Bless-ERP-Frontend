"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Warehouse as WarehouseIcon, Package, Activity, Building2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { apiClient } from "@/services/api-client"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { inventoryService } from "@/modules/inventory/services"
import type { Warehouse, InventoryMovement } from "@/modules/inventory/types"
import { cn } from "@/lib/utils"

export default function WarehouseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [stockItems, setStockItems] = useState<{ item_code: string; actual_qty: number; stock_value: number }[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const name = decodeURIComponent(id)
    Promise.all([
      inventoryService.getWarehouse(name),
      fetchBinByWarehouse(name),
      inventoryService.listMovements({ warehouse: name, pageSize: 20 }),
    ]).then(([wh, bins, movRes]) => {
      setWarehouse(wh)
      setStockItems(bins)
      setMovements(movRes.items)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-[16px]" />)}
          </div>
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!warehouse) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Warehouse not found.</p>
          <Button className="mt-4" onClick={() => navigate("/inventory/warehouses")}>Back to Warehouses</Button>
        </div>
      </>
    )
  }

  const totalStockQty = stockItems.reduce((s, b) => s + b.actual_qty, 0)
  const totalStockValue = stockItems.reduce((s, b) => s + b.stock_value, 0)

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
            <button onClick={() => navigate("/inventory/warehouses")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{warehouse.warehouse_name}</h1>
                {warehouse.disabled
                  ? <Badge variant="default">Disabled</Badge>
                  : <Badge variant="success">Active</Badge>
                }
              </div>
              <p className="text-sm text-muted mt-0.5 flex items-center gap-1">
                <Building2 size={12} />
                {warehouse.company}
                {warehouse.warehouse_type && <span className="ml-2">· {warehouse.warehouse_type}</span>}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate(`/inventory/warehouses/${encodeURIComponent(warehouse.name)}/edit`)}>Edit Warehouse</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-primary-600 bg-primary-50">
                <Package size={20} />
              </div>
              <div>
                <p className="text-sm text-muted">Stock Items</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{stockItems.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-success-600 bg-success-50">
                <WarehouseIcon size={20} />
              </div>
              <div>
                <p className="text-sm text-muted">Total Qty</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{totalStockQty}</p>
                <p className="text-xs text-muted mt-0.5">Value: {formatCurrency(totalStockValue)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-info-600 bg-info-50">
                <Activity size={20} />
              </div>
              <div>
                <p className="text-sm text-muted">Recent Movements</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{movements.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Stock in Warehouse</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Item</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Qty</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {stockItems.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted">No stock in this warehouse.</td>
                    </tr>
                  ) : (
                    stockItems.map((b) => (
                      <tr key={b.item_code} className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                        onClick={() => navigate(`/products/${encodeURIComponent(b.item_code)}`)}>
                        <td className="px-5 py-3 text-sm font-medium text-heading">{b.item_code}</td>
                        <td className={cn(
                          "px-5 py-3 text-sm font-semibold tabular-nums text-right",
                          b.actual_qty === 0 ? "text-danger-600" : b.actual_qty < 20 ? "text-warning-600" : "text-body"
                        )}>
                          {b.actual_qty}
                        </td>
                        <td className="px-5 py-3 text-sm text-muted tabular-nums text-right">{formatCurrency(b.stock_value)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Movements</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Item</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-muted/80">Type</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted">No recent movements.</td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.name} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3 text-sm text-muted">{new Date(m.posting_date).toLocaleDateString()}</td>
                        <td className="px-5 py-3 text-sm font-medium text-heading">{m.item_code}</td>
                        <td className="px-5 py-3 text-center">
                          <TypeBadge type={m.movement_type} />
                        </td>
                        <td className={cn(
                          "px-5 py-3 text-sm font-semibold tabular-nums text-right",
                          m.actual_qty > 0 ? "text-success-600" : "text-danger-600"
                        )}>
                          {m.actual_qty > 0 ? "+" : ""}{m.actual_qty}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Warehouse Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DetailItem label="Name" value={warehouse.name} />
              <DetailItem label="Warehouse Name" value={warehouse.warehouse_name} />
              <DetailItem label="Company" value={warehouse.company} />
              <DetailItem label="Type" value={warehouse.warehouse_type ?? "—"} />
              <DetailItem label="Parent" value={warehouse.parent_warehouse ?? "—"} />
              <DetailItem label="Account" value={warehouse.account ?? "—"} />
              <DetailItem label="Created" value={new Date(warehouse.creation).toLocaleDateString()} />
              <DetailItem label="Modified" value={new Date(warehouse.modified).toLocaleDateString()} />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; variant: "success" | "danger" | "warning" | "info" }> = {
    in: { label: "In", variant: "success" },
    out: { label: "Out", variant: "danger" },
    transfer: { label: "Transfer", variant: "warning" },
    adjustment: { label: "Adj.", variant: "info" },
  }
  const m = map[type] ?? { label: type, variant: "info" as const }
  return <Badge variant={m.variant}>{m.label}</Badge>
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-heading mt-0.5">{value}</p>
    </div>
  )
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

async function fetchBinByWarehouse(warehouse: string): Promise<{ item_code: string; actual_qty: number; stock_value: number }[]> {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(["item_code", "actual_qty", "stock_value"]))
  qp.set("filters", JSON.stringify([["warehouse", "=", warehouse]]))
  qp.set("limit_page_length", "0")
  return apiClient<Array<{ item_code: string; actual_qty: number; stock_value: number }>>(`/resource/Bin?${qp.toString()}`)
}
