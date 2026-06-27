"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Warehouse as WarehouseIcon, MapPin, Package, Activity } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { inventoryService } from "@/modules/inventory/services"
import { productService, type Product } from "@/services"
import type { Warehouse, InventoryMovement } from "@/modules/inventory/types"
import { cn } from "@/lib/utils"

export default function WarehouseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      inventoryService.getWarehouse(id),
      productService.list({ pageSize: 100 }),
      inventoryService.listMovements({ warehouse: id, pageSize: 20 }),
    ]).then(([wh, prodRes, movRes]) => {
      setWarehouse(wh)
      setProducts(prodRes.items.filter((p) => p.warehouse === wh.name))
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

  const usagePct = Math.round((warehouse.usedCapacity / warehouse.capacity) * 100)

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
                <h1 className="text-2xl font-bold text-heading">{warehouse.name}</h1>
                <Badge variant={warehouse.status === "active" ? "success" : warehouse.status === "maintenance" ? "warning" : "default"}>
                  {warehouse.status.charAt(0).toUpperCase() + warehouse.status.slice(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5 flex items-center gap-1">
                <MapPin size={12} />
                {warehouse.location}
              </p>
            </div>
          </div>
          <Button variant="secondary">Edit Warehouse</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-primary-600 bg-primary-50">
                <Package size={20} />
              </div>
              <div>
                <p className="text-sm text-muted">Products Stored</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{products.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-success-600 bg-success-50">
                <WarehouseIcon size={20} />
              </div>
              <div>
                <p className="text-sm text-muted">Capacity Used</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{usagePct}%</p>
                <p className="text-xs text-muted mt-0.5">{warehouse.usedCapacity.toLocaleString()} / {warehouse.capacity.toLocaleString()} units</p>
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
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Product</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">SKU</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted">No products in this warehouse.</td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                        onClick={() => navigate(`/products/${p.id}`)}>
                        <td className="px-5 py-3 text-sm font-medium text-heading">{p.name}</td>
                        <td className="px-5 py-3 text-sm text-muted text-right">{p.sku}</td>
                        <td className={cn(
                          "px-5 py-3 text-sm font-semibold tabular-nums text-right",
                          p.stock === 0 ? "text-danger-600" : p.stock < 10 ? "text-warning-600" : "text-body"
                        )}>
                          {p.stock} {p.unit}
                        </td>
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
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Product</th>
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
                      <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3 text-sm text-muted">{new Date(m.date).toLocaleDateString()}</td>
                        <td className="px-5 py-3 text-sm font-medium text-heading">{m.productName}</td>
                        <td className="px-5 py-3 text-center">
                          <TypeBadge type={m.type} />
                        </td>
                        <td className={cn(
                          "px-5 py-3 text-sm font-semibold tabular-nums text-right",
                          m.type === "in" ? "text-success-600" : "text-danger-600"
                        )}>
                          {m.type === "in" ? "+" : "-"}{m.quantity}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
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
