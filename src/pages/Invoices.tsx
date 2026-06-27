"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, FileText, ArrowRight } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { invoiceService, type Invoice, type InvoiceListResponse } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

const statusStyles: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  paid: "success",
  sent: "info",
  draft: "warning",
  overdue: "danger",
  cancelled: "default",
}

const columns: Column<Invoice>[] = [
  {
    key: "number",
    header: "Invoice",
    render: (inv) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
          <FileText size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{inv.number}</p>
          <p className="text-xs text-muted">
            {new Date(inv.issueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "customerName",
    header: "Customer",
    render: (inv) => <span className="text-sm text-body">{inv.customerName}</span>,
  },
  {
    key: "total",
    header: "Amount",
    className: "text-right",
    render: (inv) => (
      <span className="font-semibold tabular-nums text-heading">
        {formatCurrency(inv.total)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (inv) => (
      <Badge variant={statusStyles[inv.status] ?? "default"}>
        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
      </Badge>
    ),
  },
  {
    key: "dueDate",
    header: "Due Date",
    hideOnMobile: true,
    render: (inv) => {
      const isOverdue = inv.status === "overdue"
      return (
        <span className={cn("text-xs", isOverdue ? "text-danger-600 font-semibold" : "text-muted")}>
          {new Date(inv.dueDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      )
    },
  },
]

export default function Invoices() {
  const navigate = useNavigate()
  const [data, setData] = useState<InvoiceListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoiceService.list({ search, page, pageSize: 10 })
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
            <h1 className="text-2xl font-bold text-heading">Invoices</h1>
            <p className="text-sm text-muted mt-1">Create and manage sales invoices.</p>
          </div>
          <Button onClick={() => navigate("/invoices/new")}>
            <Plus size={16} />
            New Invoice
          </Button>
        </div>

        {data && (
          <p className="text-sm text-muted">
            <strong className="text-heading">{data.total}</strong> invoices
          </p>
        )}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(inv) => inv.id}
          searchable
          searchPlaceholder="Search invoices..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
        />
      </motion.div>
    </>
  )
}
