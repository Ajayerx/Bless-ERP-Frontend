"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { invoiceService, type Invoice, type InvoiceListResponse } from "@/services"
import InvoiceTable from "@/modules/invoices/InvoiceTable"

type StatusFilter = "All" | "Paid" | "Sent" | "Overdue" | "Draft" | "Cancelled"

export default function Invoices() {
  const navigate = useNavigate()
  const [data, setData] = useState<InvoiceListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoiceService.list({
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

  const handleRecordPayment = (inv: Invoice) => {
    navigate(`/payments?invoice=${inv.id}`)
  }

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Invoices</h1>
            <p className="text-sm text-muted mt-1">
              Create and manage your sales invoices.
            </p>
          </div>
          <Button onClick={() => navigate("/invoices/new")}>
            <Plus size={16} />
            New Invoice
          </Button>
        </div>

        <InvoiceTable
          data={data}
          loading={loading}
          search={search}
          onSearch={(q) => {
            setSearch(q)
            setPage(1)
          }}
          page={page}
          onPageChange={setPage}
          activeFilter={activeFilter}
          onFilterChange={(f) => {
            setActiveFilter(f)
            setPage(1)
          }}
          onRowClick={(inv) => navigate(`/invoices/${inv.id}`)}
          onRecordPayment={handleRecordPayment}
          toolbarActions={
            <Button variant="secondary" size="sm">
              Export
            </Button>
          }
        />
      </motion.div>
    </>
  )
}
