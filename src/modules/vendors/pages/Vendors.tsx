"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Building2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { vendorService, type VendorListResponse } from "@/services"
import VendorTable from "../components/VendorTable"

export default function Vendors() {
  const navigate = useNavigate()
  const [data, setData] = useState<VendorListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await vendorService.list({ search, page, pageSize: 10 })
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
            <h1 className="text-2xl font-bold text-heading">Vendors</h1>
            <p className="text-sm text-muted mt-1">Manage your vendor directory.</p>
          </div>
          <Button onClick={() => navigate("/vendors/new")}><Plus size={16} /> Add Vendor</Button>
        </div>
        {data && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Building2 size={16} />
            <span><strong className="text-heading">{data.total}</strong> total vendors</span>
          </div>
        )}
        <VendorTable
          data={data} loading={loading} search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page} onPageChange={setPage}
          onRowClick={(v) => navigate(`/vendors/${v.id}`)}
        />
      </motion.div>
    </>
  )
}
