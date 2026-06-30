"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { supplierService, type SupplierListResponse } from "@/services"
import SupplierTable from "@/modules/suppliers/SupplierTable"

export default function Suppliers() {
  const navigate = useNavigate()
  const [data, setData] = useState<SupplierListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await supplierService.list({ search, page, pageSize: 10 })
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
            <h1 className="text-2xl font-bold text-heading">Suppliers</h1>
            <p className="text-sm text-muted mt-1">Manage your vendor directory.</p>
          </div>
          <Button onClick={() => navigate("/suppliers/new")}><Plus size={16} /> Add Supplier</Button>
        </div>
        <SupplierTable
          data={data} loading={loading} search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page} onPageChange={setPage}
          onRowClick={(supplier) => navigate(`/suppliers/${supplier.id}`)}
        />
      </motion.div>
    </>
  )
}
