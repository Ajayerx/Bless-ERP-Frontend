"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Package } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { productService, type Product, type ProductListResponse } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

const columns: Column<Product>[] = [
  {
    key: "name",
    header: "Product",
    render: (p) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
          <Package size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{p.name}</p>
          <p className="text-xs text-muted">SKU: {p.sku}</p>
        </div>
      </div>
    ),
  },
  {
    key: "category",
    header: "Category",
    hideOnMobile: true,
    render: (p) => <span className="text-sm text-body">{p.category}</span>,
  },
  {
    key: "price",
    header: "Price",
    className: "text-right",
    render: (p) => (
      <span className="font-semibold tabular-nums text-heading">{formatCurrency(p.price)}</span>
    ),
  },
  {
    key: "stock",
    header: "Stock",
    className: "text-right",
    render: (p) => (
      <span className={cn(
        "font-semibold tabular-nums",
        p.stock < 10 ? "text-danger-600" : p.stock < 30 ? "text-warning-600" : "text-heading"
      )}>
        {p.stock} {p.unit}
      </span>
    ),
  },
  {
    key: "warehouse",
    header: "Warehouse",
    hideOnMobile: true,
    render: (p) => <span className="text-sm text-muted">{p.warehouse}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (p) => (
      <Badge variant={p.status === "active" ? "success" : "default"}>
        {p.status === "active" ? "Active" : "Inactive"}
      </Badge>
    ),
  },
]

export default function Products() {
  const navigate = useNavigate()
  const [data, setData] = useState<ProductListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await productService.list({ search, page, pageSize: 10 })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Products</h1>
            <p className="text-sm text-muted mt-1">Manage your product catalog and inventory.</p>
          </div>
          <Button>
            <Plus size={16} />
            Add Product
          </Button>
        </div>

        {data && (
          <p className="text-sm text-muted">
            <strong className="text-heading">{data.total}</strong> products
          </p>
        )}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(p) => p.id}
          searchable
          searchPlaceholder="Search products..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(p) => navigate(`/products/${p.id}`)}
        />
      </motion.div>
    </>
  )
}
