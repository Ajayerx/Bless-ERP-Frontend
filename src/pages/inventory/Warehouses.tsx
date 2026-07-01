"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Warehouse as WarehouseIcon, MapPin, Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { inventoryService } from "@/modules/inventory/services"
import type { Warehouse } from "@/modules/inventory/types"
import { cn } from "@/lib/utils"

const columns: Column<Warehouse>[] = [
  {
    key: "name",
    header: "Warehouse",
    render: (w) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
          <WarehouseIcon size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{w.name}</p>
          <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
            <MapPin size={10} />
            {w.location}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "capacity",
    header: "Capacity",
    className: "text-right",
    render: (w) => {
      const pct = Math.round((w.usedCapacity / w.capacity) * 100)
      return (
        <div className="flex items-center gap-3 justify-end">
          <div className="text-right">
            <p className="font-semibold text-heading text-sm tabular-nums">{pct}%</p>
            <p className="text-xs text-muted">{w.usedCapacity.toLocaleString()} / {w.capacity.toLocaleString()}</p>
          </div>
          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct > 90 ? "bg-danger-500" : pct > 70 ? "bg-warning-500" : "bg-success-500"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )
    },
  },
  {
    key: "status",
    header: "Status",
    render: (w) => {
      const map: Record<string, { label: string; variant: "success" | "warning" | "default" }> = {
        active: { label: "Active", variant: "success" },
        maintenance: { label: "Maintenance", variant: "warning" },
        inactive: { label: "Inactive", variant: "default" },
      }
      const s = map[w.status] ?? { label: w.status, variant: "default" }
      return <Badge variant={s.variant}>{s.label}</Badge>
    },
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
            <p className="text-sm text-muted mt-1">Manage storage locations and capacity.</p>
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
          keyExtractor={(w) => w.id}
          searchable
          searchPlaceholder="Search warehouses..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(w) => navigate(`/inventory/warehouses/${w.id}`)}
        />
      </motion.div>
    </>
  )
}
