"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ClipboardCheck, Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { inventoryService } from "@/modules/inventory/services"
import type { StockCount } from "@/modules/inventory/types"
import { formatDate } from "@/lib/utils"

const statusConfig: Record<number, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" }> = {
  0: { label: "Draft", variant: "default" },
  1: { label: "Completed", variant: "success" },
  2: { label: "Cancelled", variant: "danger" },
}

const columns: Column<StockCount>[] = [
  {
    key: "name",
    header: "Reference",
    render: (c) => (
      <div>
        <p className="font-semibold text-heading">{c.name}</p>
        <p className="text-xs text-muted">{formatDate(c.creation)}</p>
      </div>
    ),
  },
  {
    key: "set_warehouse",
    header: "Warehouse",
    render: (c) => <span className="text-sm text-body">{c.set_warehouse ?? "—"}</span>,
  },
  {
    key: "purpose",
    header: "Purpose",
    render: (c) => <span className="text-sm text-muted">{c.purpose}</span>,
  },
  {
    key: "items",
    header: "Items Counted",
    className: "text-right",
    render: (c) => (
      <span className="text-sm font-semibold tabular-nums text-heading">{c.items.length}</span>
    ),
  },
  {
    key: "docstatus",
    header: "Status",
    render: (c) => {
      const cfg = statusConfig[c.docstatus] ?? { label: `Unknown (${c.docstatus})`, variant: "default" as const }
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>
    },
  },
]

export default function StockCounts() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: StockCount[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await inventoryService.listCounts({ search, page, pageSize: 10 })
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
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Stock Counts</h1>
              <p className="text-sm text-muted mt-1">Track physical inventory counts.</p>
            </div>
          </div>
          <Button onClick={() => navigate("/inventory/counts/new")}>
            <Plus size={16} />
            New Stock Count
          </Button>
        </div>

        {data && (
          <p className="text-sm text-muted">
            <strong className="text-heading">{data.total}</strong> stock counts
          </p>
        )}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(c) => c.name}
          searchable
          searchPlaceholder="Search stock counts..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(c) => navigate(`/inventory/counts/${encodeURIComponent(c.name)}`)}
        />
      </motion.div>
    </>
  )
}
