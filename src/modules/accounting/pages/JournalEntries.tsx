"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, BookOpen } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { accountingService } from "@/services"
import type { JournalEntry } from "@/modules/accounting/types"
import { formatCurrency, formatDate } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: "success" | "default" | "info" }> = {
  draft: { label: "Draft", variant: "default" },
  posted: { label: "Posted", variant: "success" },
}

const columns: Column<JournalEntry>[] = [
  {
    key: "number",
    header: "Entry",
    render: (je) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
          <BookOpen size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{je.number}</p>
          <p className="text-xs text-muted">{formatDate(je.createdAt)}</p>
        </div>
      </div>
    ),
  },
  {
    key: "description",
    header: "Description",
    render: (je) => <span className="text-sm text-body">{je.description}</span>,
  },
  {
    key: "reference",
    header: "Reference",
    render: (je) => <span className="text-sm text-muted">{je.reference || "—"}</span>,
  },
  {
    key: "totalDebit",
    header: "Debit",
    className: "text-right",
    render: (je) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(je.totalDebit)}</span>,
  },
  {
    key: "totalCredit",
    header: "Credit",
    className: "text-right",
    render: (je) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(je.totalCredit)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (je) => {
      const cfg = statusConfig[je.status] ?? { label: je.status, variant: "default" as const }
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>
    },
  },
]

export default function JournalEntries() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: JournalEntry[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await accountingService.listJournalEntries({ search, page, pageSize: 10 })
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
            <div className="p-2 rounded-[10px] bg-primary-50 text-primary-600"><BookOpen size={20} /></div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Journal Entries</h1>
              <p className="text-sm text-muted mt-1">Manage general ledger journal entries.</p>
            </div>
          </div>
          <Button onClick={() => navigate("/accounting/journal-entries/new")}><Plus size={16} /> New Entry</Button>
        </div>
        {data && <p className="text-sm text-muted"><strong className="text-heading">{data.total}</strong> journal entries</p>}
        <DataTable
          columns={columns} data={data?.items ?? []} keyExtractor={(je) => je.id}
          searchable searchPlaceholder="Search journal entries..." searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading} page={page} total={data?.total} pageSize={10} onPageChange={setPage}
          onRowClick={(je) => navigate(`/accounting/journal-entries/${je.id}`)}
        />
      </motion.div>
    </>
  )
}
