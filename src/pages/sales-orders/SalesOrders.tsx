"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { salesOrderService, type SalesOrderListResponse } from "@/services"
import SalesOrderTable from "@/modules/sales-orders/SalesOrderTable"

type Filter = "All" | "Draft" | "Confirmed" | "Completed" | "Cancelled"

export default function SalesOrders() {
  const navigate = useNavigate()
  const [data, setData] = useState<SalesOrderListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<Filter>("All")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await salesOrderService.list({
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
        <div>
          <h1 className="text-2xl font-bold text-heading">Sales Orders</h1>
          <p className="text-sm text-muted mt-1">Track customer orders and fulfillment.</p>
        </div>
        <SalesOrderTable
          data={data} loading={loading} search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page} onPageChange={setPage}
          activeFilter={activeFilter} onFilterChange={(f) => { setActiveFilter(f); setPage(1) }}
          onRowClick={(so) => navigate(`/sales-orders/${so.id}`)}
        />
      </motion.div>
    </>
  )
}
