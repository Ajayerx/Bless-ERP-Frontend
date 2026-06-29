"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Wallet } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { accountingService } from "@/services"
import type { Expense } from "@/modules/accounting/types"
import { formatCurrency, formatDate } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" }> = {
  draft: { label: "Draft", variant: "default" },
  pending: { label: "Pending", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
}

const columns: Column<Expense>[] = [
  {
    key: "number",
    header: "Expense",
    render: (e) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-danger-50 text-danger-600 flex items-center justify-center">
          <Wallet size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{e.number}</p>
          <p className="text-xs text-muted">{formatDate(e.createdAt)}</p>
        </div>
      </div>
    ),
  },
  { key: "vendorName", header: "Vendor", render: (e) => <span className="text-sm font-medium text-body">{e.vendorName}</span> },
  { key: "category", header: "Category", render: (e) => <span className="text-sm text-muted">{e.category}</span> },
  {
    key: "total",
    header: "Amount",
    className: "text-right",
    render: (e) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(e.total)}</span>,
  },
  {
    key: "date",
    header: "Date",
    className: "text-right",
    render: (e) => <span className="text-sm text-muted tabular-nums">{formatDate(e.date)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (e) => {
      const cfg = statusConfig[e.status] ?? { label: e.status, variant: "default" as const }
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>
    },
  },
]

export default function Expenses() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: Expense[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await accountingService.listExpenses({ search, page, pageSize: 10 })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-danger-50 text-danger-600"><Wallet size={20} /></div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Expenses</h1>
              <p className="text-sm text-muted mt-1">Track and manage business expenses.</p>
            </div>
          </div>
          <Button onClick={() => navigate("/accounting/expenses/new")}><Plus size={16} /> Add Expense</Button>
        </div>
        {data && <p className="text-sm text-muted"><strong className="text-heading">{data.total}</strong> expenses</p>}
        <DataTable
          columns={columns} data={data?.items ?? []} keyExtractor={(e) => e.id}
          searchable searchPlaceholder="Search expenses..." searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading} page={page} total={data?.total} pageSize={10} onPageChange={setPage}
          onRowClick={(e) => navigate(`/accounting/expenses/${e.id}`)}
        />
      </motion.div>
    </>
  )
}
