"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { billService, type BillListResponse } from "@/services"
import BillTable from "@/modules/bills/BillTable"

type Filter = "All" | "Received" | "Paid" | "Overdue"

export default function Bills() {
  const navigate = useNavigate()
  const [data, setData] = useState<BillListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<Filter>("All")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await billService.list({
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
            <h1 className="text-2xl font-bold text-heading">Bills</h1>
            <p className="text-sm text-muted mt-1">Track supplier bills and payments.</p>
          </div>
          <Button onClick={() => navigate("/bills/new")}><Plus size={16} /> New Bill</Button>
        </div>
        <BillTable
          data={data} loading={loading} search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page} onPageChange={setPage}
          activeFilter={activeFilter} onFilterChange={(f) => { setActiveFilter(f); setPage(1) }}
          onRowClick={(bill) => navigate(`/bills/${bill.id}`)}
        />
      </motion.div>
    </>
  )
}
