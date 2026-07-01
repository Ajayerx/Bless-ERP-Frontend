"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { productService } from "@/services"
import type { ProductListResponse } from "@/services/products.service"
import StockLevelTable from "@/modules/inventory/StockLevelTable"
import type { StockLevelFilter } from "@/modules/inventory/StockLevelTable"

export default function StockLevels() {
  const navigate = useNavigate()
  const [data, setData] = useState<ProductListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<StockLevelFilter>("All")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await productService.list({ search, page, pageSize: 10, filter: activeFilter })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page, activeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const inventoryValue = data?.items.reduce((sum, p) => sum + p.price * p.stock, 0)

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <StockLevelTable
          items={data?.items ?? []}
          total={data?.total}
          loading={loading}
          search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page}
          onPageChange={setPage}
          activeFilter={activeFilter}
          onFilterChange={(f) => { setActiveFilter(f); setPage(1) }}
          onRowClick={(p) => navigate(`/products/${p.id}`)}
          inventoryValue={inventoryValue}
        />
      </motion.div>
    </>
  )
}
