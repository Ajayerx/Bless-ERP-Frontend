"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeftRight, Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { inventoryService } from "@/modules/inventory/services"
import type { StockTransfer } from "@/modules/inventory/types"
import { formatDate } from "@/lib/utils"

const statusConfig: Record<number, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" }> = {
  0: { label: "Draft", variant: "default" },
  1: { label: "Submitted", variant: "success" },
  2: { label: "Cancelled", variant: "danger" },
}

const columns: Column<StockTransfer>[] = [
  {
    key: "name",
    header: "Reference",
    render: (t) => (
      <div>
        <p className="font-semibold text-heading">{t.name}</p>
        <p className="text-xs text-muted">{formatDate(t.creation)}</p>
      </div>
    ),
  },
  {
    key: "from_warehouse",
    header: "From",
    render: (t) => <span className="text-sm text-body">{t.from_warehouse ?? "—"}</span>,
  },
  {
    key: "to_warehouse",
    header: "To",
    render: (t) => <span className="text-sm text-body">{t.to_warehouse ?? "—"}</span>,
  },
  {
    key: "items",
    header: "Items",
    className: "text-right",
    render: (t) => (
      <span className="text-sm font-semibold tabular-nums text-heading">{t.items.length}</span>
    ),
  },
  {
    key: "docstatus",
    header: "Status",
    render: (t) => {
      const cfg = statusConfig[t.docstatus] ?? { label: `Unknown (${t.docstatus})`, variant: "default" as const }
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>
    },
  },
]

export default function StockTransfers() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: StockTransfer[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await inventoryService.listTransfers({ search, page, pageSize: 10 })
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
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Stock Transfers</h1>
              <p className="text-sm text-muted mt-1">Move inventory between warehouses.</p>
            </div>
          </div>
          <Button onClick={() => navigate("/inventory/transfers/new")}>
            <Plus size={16} />
            New Transfer
          </Button>
        </div>

        {data && (
          <p className="text-sm text-muted">
            <strong className="text-heading">{data.total}</strong> transfers
          </p>
        )}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(t) => t.name}
          searchable
          searchPlaceholder="Search transfers..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(t) => navigate(`/inventory/transfers/${encodeURIComponent(t.name)}`)}
        />
      </motion.div>
    </>
  )
}
