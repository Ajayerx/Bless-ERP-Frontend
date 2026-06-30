"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { purchaseOrderService, type PurchaseOrderListResponse } from "@/services/purchase_orders.service"
import PurchaseTable from "@/modules/invoices/PurchaseTable"

type StatusFilter = "All" | "Draft" | "Sent" | "Received" | "Cancelled"

export default function Purchases() {
  const navigate = useNavigate()
  const [data, setData] = useState<PurchaseOrderListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await purchaseOrderService.list({
        search,
        page,
        pageSize: 10,
        status: activeFilter === "All" ? undefined : activeFilter.toLowerCase(),
      })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page, activeFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
          <div>
            <h1 className="text-2xl font-bold text-heading">Purchase Orders</h1>
            <p className="text-sm text-muted mt-1">
              Manage purchase orders and supplier deliveries.
            </p>
          </div>
          <Button onClick={() => navigate("/purchases/new")}><Plus size={16} /> New Purchase Order</Button>
        </div>

        <PurchaseTable
          data={data}
          loading={loading}
          search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page}
          onPageChange={setPage}
          activeFilter={activeFilter}
          onFilterChange={(f) => { setActiveFilter(f); setPage(1) }}
          onRowClick={(po) => navigate(`/purchases/${po.id}`)}
        />
      </motion.div>
    </>
  )
}
