"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { customerService, type CustomerListResponse } from "@/services"
import CustomerTable from "@/modules/customers/CustomerTable"

export default function Customers() {
  const navigate = useNavigate()
  const [data, setData] = useState<CustomerListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await customerService.list({ search, page, pageSize: 10 })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page])

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
            <h1 className="text-2xl font-bold text-heading">Customers</h1>
            <p className="text-sm text-muted mt-1">Manage your customer directory.</p>
          </div>
          <Button onClick={() => navigate("/customers/new")}>
            <Plus size={16} />
            Add Customer
          </Button>
        </div>

        <CustomerTable
          data={data}
          loading={loading}
          search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page}
          onPageChange={setPage}
          toolbarActions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm">Export</Button>
              <Button variant="secondary" size="sm">Import</Button>
            </div>
          }
          onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
        />
      </motion.div>
    </>
  )
}
