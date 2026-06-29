"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Package, AlertTriangle, Warehouse, TrendingDown } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { productService, type Product } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

const columns: Column<Product>[] = [
  {
    key: "name",
    header: "Product",
    render: (p) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
          <Package size={14} />
        </div>
        <div>
          <p className="font-semibold text-heading text-sm">{p.name}</p>
          <p className="text-xs text-muted">{p.sku}</p>
        </div>
      </div>
    ),
  },
  {
    key: "warehouse",
    header: "Warehouse",
    render: (p) => <span className="text-sm text-body">{p.warehouse}</span>,
  },
  {
    key: "stock",
    header: "Stock",
    className: "text-right",
    render: (p) => (
      <span className={cn(
        "font-semibold tabular-nums text-sm",
        p.stock === 0 ? "text-danger-600" : p.stock < 10 ? "text-warning-600" : "text-heading"
      )}>
        {p.stock} {p.unit}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (p) => {
      if (p.stock === 0) return <Badge variant="danger">Out of Stock</Badge>
      if (p.stock < 10) return <Badge variant="warning">Low Stock</Badge>
      return <Badge variant="success">In Stock</Badge>
    },
  },
]

export default function Inventory() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    productService.list({ pageSize: 100 })
      .then((res) => setProducts(res.items))
      .finally(() => setLoading(false))
  }, [])

  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0)
  const lowStock = products.filter((p) => p.stock > 0 && p.stock < 10).length
  const outOfStock = products.filter((p) => p.stock === 0).length

  const summaryCards = [
    { label: "Total Products", value: products.length, icon: Package, color: "text-primary-600 bg-primary-50" },
    { label: "Inventory Value", value: formatCurrency(totalValue), icon: TrendingDown, color: "text-success-600 bg-success-50" },
    { label: "Low Stock Items", value: lowStock, icon: AlertTriangle, color: "text-warning-600 bg-warning-50" },
    { label: "Out of Stock", value: outOfStock, icon: Warehouse, color: "text-danger-600 bg-danger-50" },
  ]

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-heading">Inventory Overview</h1>
          <p className="text-sm text-muted mt-1">Monitor stock levels and inventory health.</p>
        </div>

        {/* Summary Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-[16px]" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {summaryCards.map((card) => (
              <motion.div
                key={card.label}
                whileHover={{ y: -2 }}
                className="bg-surface rounded-[16px] border border-border shadow-card p-5"
              >
                <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-[10px]", card.color)}>
                    <card.icon size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">{card.label}</p>
                    <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{card.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Inventory Table */}
        <DataTable
          columns={columns}
          data={products}
          keyExtractor={(p) => p.id}
          loading={loading}
          pageSize={15}
          onRowClick={(p) => navigate(`/products/${p.id}`)}
        />
      </motion.div>
    </>
  )
}
