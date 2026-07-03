"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import { UserPlus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { followUpService, type FollowUp } from "@/services"
import FollowUpTable from "../components/FollowUpTable"

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
      const result = await followUpService.list({ search, page, pageSize: 10, ...(statusFilter ? { status: statusFilter } : {}) })
      setData(result)
    } finally { setLoading(false) }
  }, [search, page, statusFilter])

  useEffect(() => { refreshRef.current = loadData; loadData() }, [loadData])

  const handleComplete = async (id: string) => {
    await followUpService.complete(id)
    refreshRef.current()
  }

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
        <FollowUpTable
          data={data} loading={loading} search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page} onPageChange={setPage}
          statusFilter={statusFilter} onStatusFilterChange={(s) => { setStatusFilter(s); setPage(1) }}
          onComplete={handleComplete}
        />
      </motion.div>
    </>
  )
}
