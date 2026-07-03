"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Target } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { leadService, type Lead } from "@/services"
import LeadTable from "../components/LeadTable"

export default function Leads() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: Lead[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await leadService.list({ search, page, pageSize: 10 })
      setData(result)
    } finally { setLoading(false) }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-warning-50 text-warning-600"><Target size={20} /></div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Leads</h1>
              <p className="text-sm text-muted mt-1">Track and manage potential sales leads.</p>
            </div>
          </div>
          <Button onClick={() => navigate("/leads/new")}><Plus size={16} /> Add Lead</Button>
        </div>
        <LeadTable
          data={data} loading={loading} search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page} onPageChange={setPage}
          onRowClick={(lead) => navigate(`/leads/${lead.id}`)}
        />
      </motion.div>
    </>
  )
}
