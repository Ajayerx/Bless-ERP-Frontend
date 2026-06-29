"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, ShoppingBag } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { purchaseOrderService } from "@/services"
import type { PurchaseOrder } from "@/modules/purchases/types"
import { formatCurrency, formatDate } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" | "purple" | "primary" }> = {
  draft: { label: "Draft", variant: "default" },
  pending_approval: { label: "Pending Approval", variant: "warning" },
  approved: { label: "Approved", variant: "primary" },
  ordered: { label: "Ordered", variant: "info" },
  partially_received: { label: "Partially Received", variant: "purple" },
  received: { label: "Received", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
}

const columns: Column<PurchaseOrder>[] = [
  {
    key: "number",
    header: "Order",
    render: (po) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-info-50 text-info-600 flex items-center justify-center">
          <ShoppingBag size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{po.number}</p>
          <p className="text-xs text-muted">{formatDate(po.createdAt)}</p>
        </div>
      </div>
    ),
  },
  {
    key: "vendorName",
    header: "Vendor",
    render: (po) => <span className="text-sm font-medium text-body">{po.vendorName}</span>,
  },
  {
    key: "deliveryDate",
    header: "Delivery",
    className: "text-right",
    render: (po) => <span className="text-sm text-muted tabular-nums">{formatDate(po.deliveryDate)}</span>,
  },
  {
    key: "total",
    header: "Amount",
    className: "text-right",
    render: (po) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(po.total)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (po) => {
      const cfg = statusConfig[po.status] ?? { label: po.status, variant: "default" as const }
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>
    },
  },
]

export default function PurchaseOrders() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: PurchaseOrder[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await purchaseOrderService.list({ search, page, pageSize: 10 })
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
            <div className="p-2 rounded-[10px] bg-info-50 text-info-600">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Purchase Orders</h1>
              <p className="text-sm text-muted mt-1">Manage purchase orders and vendor deliveries.</p>
            </div>
          </div>
          <Button onClick={() => navigate("/purchases/orders/new")}>
            <Plus size={16} />
            New Purchase Order
          </Button>
        </div>

        {data && (
          <p className="text-sm text-muted">
            <strong className="text-heading">{data.total}</strong> purchase orders
          </p>
        )}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(po) => po.id}
          searchable
          searchPlaceholder="Search purchase orders..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(po) => navigate(`/purchases/orders/${po.id}`)}
        />
      </motion.div>
    </>
  )
}
