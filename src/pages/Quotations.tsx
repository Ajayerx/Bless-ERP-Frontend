"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, FileText } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { quotationService, type Quotation } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" | "purple" }> = {
  draft: { label: "Draft", variant: "default" },
  sent: { label: "Sent", variant: "info" },
  accepted: { label: "Accepted", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  expired: { label: "Expired", variant: "warning" },
}

const columns: Column<Quotation>[] = [
  {
    key: "number",
    header: "Quotation",
    render: (q) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
          <FileText size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{q.number}</p>
          <p className="text-xs text-muted">{formatDate(q.createdAt)}</p>
        </div>
      </div>
    ),
  },
  {
    key: "customerName",
    header: "Customer",
    render: (q) => <span className="text-sm font-medium text-body">{q.customerName}</span>,
  },
  {
    key: "total",
    header: "Amount",
    className: "text-right",
    render: (q) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(q.total)}</span>,
  },
  {
    key: "validUntil",
    header: "Valid Until",
    className: "text-right",
    render: (q) => {
      const expired = new Date(q.validUntil) < new Date() && q.status === "sent"
      return (
        <span className={cn("text-sm tabular-nums", expired ? "text-danger-600 font-semibold" : "text-muted")}>
          {formatDate(q.validUntil)}
        </span>
      )
    },
  },
  {
    key: "status",
    header: "Status",
    render: (q) => {
      const cfg = statusConfig[q.status] ?? { label: q.status, variant: "default" as const }
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>
    },
  },
]

export default function Quotations() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: Quotation[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await quotationService.list({ search, page, pageSize: 10 })
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
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Quotations</h1>
              <p className="text-sm text-muted mt-1">Create and manage sales quotations.</p>
            </div>
          </div>
          <Button onClick={() => navigate("/quotations/new")}>
            <Plus size={16} />
            New Quotation
          </Button>
        </div>

        {data && (
          <p className="text-sm text-muted">
            <strong className="text-heading">{data.total}</strong> quotations
          </p>
        )}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(q) => q.id}
          searchable
          searchPlaceholder="Search quotations..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(q) => navigate(`/quotations/${q.id}`)}
        />
      </motion.div>
    </>
  )
}
