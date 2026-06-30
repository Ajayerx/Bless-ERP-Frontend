"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { quotationService, type QuotationListResponse } from "@/services"
import QuotationTable from "@/modules/quotations/QuotationTable"

type Filter = "All" | "Draft" | "Sent" | "Accepted" | "Declined" | "Converted"

export default function Quotations() {
  const navigate = useNavigate()
  const [data, setData] = useState<QuotationListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<Filter>("All")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await quotationService.list({
        search, page, pageSize: 10,
        status: activeFilter === "All" ? undefined : activeFilter.toLowerCase(),
      })
      setData(result)
    } finally { setLoading(false) }
  }, [search, page, activeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Quotations</h1>
            <p className="text-sm text-muted mt-1">Create and manage customer quotations.</p>
          </div>
          <Button onClick={() => navigate("/quotations/new")}><Plus size={16} /> New Quotation</Button>
        </div>
        <QuotationTable
          data={data} loading={loading} search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page} onPageChange={setPage}
          activeFilter={activeFilter} onFilterChange={(f) => { setActiveFilter(f); setPage(1) }}
        />
      </motion.div>
    </>
  )
}
