"use client"
import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { opportunityService, type OpportunityListResponse } from "@/services/opportunities.service"
import OpportunityTable from "@/modules/opportunities/OpportunityTable"

export default function Opportunities() {
  const navigate = useNavigate()
  const [data, setData] = useState<OpportunityListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await opportunityService.list()
      setData(result)
    } finally { setLoading(false) }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Opportunities</h1>
            <p className="text-sm text-muted mt-1">Track and manage sales opportunities.</p>
          </div>
          <Button onClick={() => navigate("/opportunities/new")}><Plus size={16} /> New Opportunity</Button>
        </div>
        <OpportunityTable
          data={data} loading={loading} search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page} onPageChange={setPage}
          onRowClick={(id) => navigate(`/opportunities/${id}`)}
        />
      </motion.div>
    </>
  )
}
