"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Warehouse as WarehouseIcon, Building2, Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { inventoryService } from "@/modules/inventory/services"
import type { Warehouse } from "@/modules/inventory/types"
import { cn } from "@/lib/utils"

const columns: Column<Warehouse>[] = [
  {
    key: "warehouse_name",
    header: "Warehouse",
    render: (w) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
          <WarehouseIcon size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{w.warehouse_name}</p>
          <p className="text-xs text-muted mt-0.5">{w.name}</p>
        </div>
      </div>
    ),
  },
  {
    key: "company",
    header: "Company",
    render: (w) => (
      <span className="text-sm text-body flex items-center gap-1.5">
        <Building2 size={13} className="text-muted/60" />
        {w.company}
      </span>
    ),
  },
  {
    key: "warehouse_type",
    header: "Type",
    render: (w) => (
      <span className="text-sm text-muted">{w.warehouse_type ?? "—"}</span>
    ),
  },
  {
    key: "parent_warehouse",
    header: "Parent",
    render: (w) => (
      <span className="text-sm text-muted">{w.parent_warehouse ?? "—"}</span>
    ),
  },
  {
    key: "is_group",
    header: "Group",
    align: "center",
    render: (w) => (
      <span className={cn("text-sm", w.is_group ? "text-primary-600 font-semibold" : "text-muted")}>
        {w.is_group ? "Yes" : "No"}
      </span>
    ),
  },
  {
    key: "disabled",
    header: "Status",
    render: (w) => (
      w.disabled
        ? <Badge variant="default">Disabled</Badge>
        : <Badge variant="success">Active</Badge>
    ),
  },
]

export default function Warehouses() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: Warehouse[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await inventoryService.listWarehouses({ search, page, pageSize: 10 })
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
          <div>
            <h1 className="text-2xl font-bold text-heading">Warehouses</h1>
            <p className="text-sm text-muted mt-1">Manage storage locations.</p>
          </div>
          <Button onClick={() => navigate("/inventory/warehouses/new")}>
            <Plus size={16} />
            Add Warehouse
          </Button>
        </div>

        {data && (
          <p className="text-sm text-muted">
            <strong className="text-heading">{data.total}</strong> warehouses
          </p>
        )}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(w) => w.name}
          searchable
          searchPlaceholder="Search warehouses..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(w) => navigate(`/inventory/warehouses/${encodeURIComponent(w.name)}`)}
        />
      </motion.div>
    </>
  )
}
