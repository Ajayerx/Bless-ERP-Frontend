"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import { UserPlus, CheckCircle2, Circle, AlertCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui"
import { followUpService } from "@/services"
import type { FollowUp } from "@/modules/crm/types"
import { formatDate, cn } from "@/lib/utils"

const priorityStyles: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  low: { label: "Low", variant: "default" },
  medium: { label: "Medium", variant: "warning" },
  high: { label: "High", variant: "danger" },
}

const relatedLabels: Record<string, string> = {
  lead: "Lead", opportunity: "Opportunity", contact: "Contact",
}

export default function FollowUps() {
  const [data, setData] = useState<{ items: FollowUp[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const refreshRef = useRef<() => void>(() => {})

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await followUpService.list({
        search, page, pageSize: 10,
        ...(statusFilter ? { status: statusFilter } : {}),
      })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page, statusFilter])

  useEffect(() => { refreshRef.current = loadData; loadData() }, [loadData])

  const handleComplete = async (id: string) => {
    await followUpService.complete(id)
    refreshRef.current()
  }

  const columns: Column<FollowUp>[] = [
    {
      key: "title",
      header: "Task",
      render: (f) => (
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); handleComplete(f.id) }}
            className="shrink-0"
            disabled={f.status === "completed"}
          >
            {f.status === "completed" ? (
              <CheckCircle2 size={18} className="text-success-500" />
            ) : (
              <Circle size={18} className="text-muted hover:text-primary-500 transition-colors" />
            )}
          </button>
          <div>
            <p className={cn("font-semibold", f.status === "completed" ? "text-muted line-through" : "text-heading")}>
              {f.title}
            </p>
            <p className="text-xs text-muted">{f.relatedName}</p>
          </div>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (f) => {
        const p = priorityStyles[f.priority] ?? { label: f.priority, variant: "default" as const }
        return <Badge variant={p.variant}>{p.label}</Badge>
      },
    },
    {
      key: "relatedType",
      header: "Related To",
      render: (f) => (
        <span className="text-xs capitalize bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
          {relatedLabels[f.relatedType] ?? f.relatedType}
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Due Date",
      className: "text-right",
      render: (f) => {
        const overdue = new Date(f.dueDate) < new Date() && f.status === "pending"
        return (
          <span className={cn("text-sm tabular-nums flex items-center gap-1 justify-end", overdue ? "text-danger-600 font-semibold" : "text-muted")}>
            {overdue && <AlertCircle size={12} />}
            {formatDate(f.dueDate)}
          </span>
        )
      },
    },
  ]

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[10px] bg-primary-50 text-primary-600"><UserPlus size={20} /></div>
          <div>
            <h1 className="text-2xl font-bold text-heading">Follow Ups</h1>
            <p className="text-sm text-muted mt-1">Track and manage follow-up tasks.</p>
          </div>
        </div>

        <Tabs defaultValue="all" onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1) }}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          {["all", "pending", "completed"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              {data && (
                <p className="text-sm text-muted mb-4">
                  <strong className="text-heading">{data.total}</strong> follow-ups
                </p>
              )}
              <DataTable
                columns={columns}
                data={data?.items ?? []}
                keyExtractor={(f) => f.id}
                searchable searchPlaceholder="Search follow-ups..." searchQuery={search}
                onSearch={(q) => { setSearch(q); setPage(1) }}
                loading={loading} page={page} total={data?.total} pageSize={10} onPageChange={setPage}
                emptyState={
                  <div className="flex flex-col items-center gap-2 py-8">
                    <CheckCircle2 size={32} className="text-success-300" />
                    <p className="font-medium text-body">All caught up!</p>
                    <p className="text-xs text-muted">No pending follow-ups.</p>
                  </div>
                }
              />
            </TabsContent>
          ))}
        </Tabs>
      </motion.div>
    </>
  )
}
