"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { invoiceService, type SalesInvoice, type SalesInvoiceListResponse } from "@/services"
import InvoiceTable from "../components/InvoiceTable"

type StatusFilter = "All" | "Paid" | "Unpaid" | "Overdue" | "Draft" | "Cancelled"

export default function Invoices() {
  const navigate = useNavigate()
  const [data, setData] = useState<SalesInvoiceListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All")

  // Filter state
  const [customerSearch, setCustomerSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const hasActiveFilters = customerSearch !== "" || dateFrom !== "" || dateTo !== ""

  const resetFilters = () => {
    setCustomerSearch("")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await invoiceService.list({
        search: customerSearch,
        page,
        pageSize: 10,
        status: activeFilter === "All" ? undefined : activeFilter.toLowerCase(),
        postingDateFrom: dateFrom || undefined,
        postingDateTo: dateTo || undefined,
      })
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices")
    } finally {
      setLoading(false)
    }
  }, [customerSearch, page, activeFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRecordPayment = (inv: SalesInvoice) => {
    navigate(`/payments?invoice=${inv.name}`)
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

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-[14px] text-sm text-red-700">
            {error}
          </div>
        )}

        <InvoiceTable
          data={data}
          loading={loading}
          page={page}
          onPageChange={setPage}
          activeFilter={activeFilter}
          onFilterChange={(f) => { setActiveFilter(f); setPage(1) }}
          onRowClick={(inv) => navigate(`/invoices/${inv.name}`)}
          onRecordPayment={handleRecordPayment}
          customerSearch={customerSearch}
          onCustomerSearchChange={(v) => { setCustomerSearch(v); setPage(1) }}
          dateFrom={dateFrom}
          onDateFromChange={(v) => { setDateFrom(v); setPage(1) }}
          dateTo={dateTo}
          onDateToChange={(v) => { setDateTo(v); setPage(1) }}
          onResetFilters={resetFilters}
          hasActiveFilters={hasActiveFilters}
          toolbarActions={
            <Button variant="secondary" size="sm">Export</Button>
          }
        />
      </motion.div>
    </>
  )
}
