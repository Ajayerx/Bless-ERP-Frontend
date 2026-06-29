"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Receipt } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { billService, type Bill, type BillListResponse } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

const statusStyles: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  paid: "success",
  pending: "info",
  draft: "warning",
  overdue: "danger",
  cancelled: "default",
}

const columns: Column<Bill>[] = [
  {
    key: "number",
    header: "Bill",
    render: (b) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
          <Receipt size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{b.number}</p>
          <p className="text-xs text-muted">
            {new Date(b.issueDate).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "vendorName",
    header: "Vendor",
    render: (b) => <span className="text-sm text-body">{b.vendorName}</span>,
  },
  {
    key: "total",
    header: "Amount",
    className: "text-right",
    render: (b) => (
      <span className="font-semibold tabular-nums text-heading">
        {formatCurrency(b.total)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (b) => (
      <Badge variant={statusStyles[b.status] ?? "default"}>
        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
      </Badge>
    ),
  },
  {
    key: "dueDate",
    header: "Due Date",
    hideOnMobile: true,
    render: (b) => {
      const isOverdue = b.status === "overdue"
      return (
        <span className={cn("text-xs", isOverdue ? "text-danger-600 font-semibold" : "text-muted")}>
          {new Date(b.dueDate).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })}
        </span>
      )
    },
  },
]

export default function Bills() {
  const navigate = useNavigate()
  const [data, setData] = useState<BillListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await billService.list({ search, page, pageSize: 10 })
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
            <h1 className="text-2xl font-bold text-heading">Bills</h1>
            <p className="text-sm text-muted mt-1">Track vendor bills and payments.</p>
          </div>
          <Button onClick={() => navigate("/purchases/bills/new")}>
            <Plus size={16} />
            New Bill
          </Button>
        </div>

        {data && (
          <p className="text-sm text-muted">
            <strong className="text-heading">{data.total}</strong> bills
          </p>
        )}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(b) => b.id}
          searchable
          searchPlaceholder="Search bills..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(b) => navigate(`/purchases/bills/${b.id}`)}
        />
      </motion.div>
    </>
  )
}
