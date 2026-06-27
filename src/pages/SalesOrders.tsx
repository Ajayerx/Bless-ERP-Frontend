"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, ShoppingCart } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { salesOrderService, type SalesOrder } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" | "purple" }> = {
  pending: { label: "Pending", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "info" },
  shipped: { label: "Shipped", variant: "purple" },
  delivered: { label: "Delivered", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
}

const columns: Column<SalesOrder>[] = [
  {
    key: "number",
    header: "Order",
    render: (so) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
          <ShoppingCart size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{so.number}</p>
          <p className="text-xs text-muted">{formatDate(so.createdAt)}</p>
        </div>
      </div>
    ),
  },
  {
    key: "customerName",
    header: "Customer",
    render: (so) => <span className="text-sm font-medium text-body">{so.customerName}</span>,
  },
  {
    key: "deliveryDate",
    header: "Delivery",
    className: "text-right",
    render: (so) => <span className="text-sm text-muted tabular-nums">{formatDate(so.deliveryDate)}</span>,
  },
  {
    key: "total",
    header: "Amount",
    className: "text-right",
    render: (so) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(so.total)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (so) => {
      const cfg = statusConfig[so.status] ?? { label: so.status, variant: "default" as const }
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>
    },
  },
]

export default function SalesOrders() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: SalesOrder[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await salesOrderService.list({ search, page, pageSize: 10 })
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-primary-50 text-primary-600">
              <ShoppingCart size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Sales Orders</h1>
              <p className="text-sm text-muted mt-1">Manage customer sales orders and fulfillments.</p>
            </div>
          </div>
          <Button onClick={() => navigate("/sales-orders/new")}>
            <Plus size={16} />
            New Sales Order
          </Button>
        </div>

        {data && (
          <p className="text-sm text-muted">
            <strong className="text-heading">{data.total}</strong> sales orders
          </p>
        )}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(so) => so.id}
          searchable
          searchPlaceholder="Search sales orders..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(so) => navigate(`/sales-orders/${so.id}`)}
        />
      </motion.div>
    </>
  )
}
