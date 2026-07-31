"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, CheckCheck, X, Printer, Download, Trash2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, useToast } from "@/components/ui"
import { invoiceService, type SalesInvoice, type SalesInvoiceListResponse } from "@/services"
import InvoiceTable from "../components/InvoiceTable"

type StatusFilter = "All" | "Paid" | "Unpaid" | "Overdue" | "Draft" | "Cancelled"

export default function Invoices() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [data, setData] = useState<SalesInvoiceListResponse | null>(null)
  const [allItems, setAllItems] = useState<SalesInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [start, setStart] = useState(0)
  const [pageLength, setPageLength] = useState(20)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkCancelling, setBulkCancelling] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Filter state
  const [customerSearch, setCustomerSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const hasActiveFilters = customerSearch !== "" || dateFrom !== "" || dateTo !== ""

  const resetFilters = () => {
    setCustomerSearch("")
    setDateFrom("")
    setDateTo("")
    setStart(0)
  }

  const fetchData = useCallback(async (append = false) => {
    setLoading(true)
    setError("")
    try {
      const result = await invoiceService.list({
        search: customerSearch,
        start: append ? start : 0,
        pageLength,
        status: activeFilter === "All" ? undefined : activeFilter.toLowerCase(),
        postingDateFrom: dateFrom || undefined,
        postingDateTo: dateTo || undefined,
      })
      setData(result)
      setAllItems((prev) => (append ? [...prev, ...result.items] : result.items))
      if (!append) setStart(pageLength)
      else setStart((s) => s + pageLength)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices")
    } finally {
      setLoading(false)
    }
  }, [customerSearch, start, pageLength, activeFilter, dateFrom, dateTo])

  useEffect(() => {
    setStart(0)
    fetchData(false)
  }, [customerSearch, activeFilter, dateFrom, dateTo, pageLength])

  const handleLoadMore = () => {
    fetchData(true)
  }

  const handlePageLengthChange = (size: number) => {
    setPageLength(size)
  }

  const selectedItems = useMemo(() => {
    return allItems.filter((inv) => selectedKeys.has(inv.name))
  }, [allItems, selectedKeys])

  const hasDraftSelected = useMemo(
    () => selectedItems.some((inv) => inv.docstatus === 0),
    [selectedItems],
  )

  const hasSubmittedSelected = useMemo(
    () => selectedItems.some((inv) => inv.docstatus === 1),
    [selectedItems],
  )

  const handleRecordPayment = (inv: SalesInvoice) => {
    navigate(`/payments?invoice=${inv.name}`)
  }

  const handleBulkSubmit = async () => {
    const names = Array.from(selectedKeys)
    setBulkSubmitting(true)
    setError("")
    try {
      await invoiceService.bulkAction("Sales Invoice", names, "submit")
      addToast(`Submitted ${names.length} invoice${names.length > 1 ? "s" : ""} successfully`, "success")
      setSelectedKeys(new Set())
      setStart(0)
      fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk submit failed")
    } finally {
      setBulkSubmitting(false)
    }
  }

  const handleBulkCancel = async () => {
    const names = Array.from(selectedKeys)
    setBulkCancelling(true)
    setError("")
    try {
      await invoiceService.bulkAction("Sales Invoice", names, "cancel")
      addToast(`Cancelled ${names.length} invoice${names.length > 1 ? "s" : ""} successfully`, "success")
      setSelectedKeys(new Set())
      setStart(0)
      fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk cancel failed")
    } finally {
      setBulkCancelling(false)
    }
  }

  const handleBulkDelete = async () => {
    const names = Array.from(selectedKeys)
    setBulkDeleting(true)
    setError("")
    try {
      await invoiceService.bulkDelete("Sales Invoice", names)
      addToast(`Deleted ${names.length} invoice${names.length > 1 ? "s" : ""} successfully`, "success")
      setSelectedKeys(new Set())
      setStart(0)
      fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk delete failed")
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleBulkPrint = () => {
    const names = Array.from(selectedKeys)
    names.forEach((name) => {
      window.open(`/api/method/frappe.utils.print_format.download_pdf?doctype=Sales+Invoice&name=${encodeURIComponent(name)}&format=Sales+Invoice`, "_blank")
    })
  }

  const handleExport = () => {
    const items = allItems
    if (items.length === 0) return
    const headers = ["Name", "Customer", "Posting Date", "Due Date", "Status", "Grand Total", "Outstanding"]
    const rows = items.map((inv) => [
      inv.name,
      inv.customer_name,
      inv.posting_date,
      inv.due_date ?? "",
      inv.status ?? "",
      inv.grand_total.toString(),
      (inv.outstanding_amount ?? "").toString(),
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;bom" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `invoices_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalAmount = allItems.reduce((s, i) => s + i.grand_total, 0)
  const paidAmount = allItems.filter((i) => i.status === "Paid").reduce((s, i) => s + i.grand_total, 0)
  const overdueCount = allItems.filter((i) => i.status === "Overdue").length
  const customerCount = new Set(allItems.map((i) => i.customer)).size

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
          data={data ? { ...data, items: allItems } : null}
          loading={loading || bulkSubmitting || bulkCancelling || bulkDeleting}
          page={1}
          onPageChange={() => {}}
          activeFilter={activeFilter}
          onFilterChange={(f) => { setActiveFilter(f); setStart(0) }}
          onRowClick={(inv) => navigate(`/invoices/${inv.name}`)}
          onRecordPayment={handleRecordPayment}
          customerSearch={customerSearch}
          onCustomerSearchChange={(v) => { setCustomerSearch(v); setStart(0) }}
          dateFrom={dateFrom}
          onDateFromChange={(v) => { setDateFrom(v); setStart(0) }}
          dateTo={dateTo}
          onDateToChange={(v) => { setDateTo(v); setStart(0) }}
          onResetFilters={resetFilters}
          hasActiveFilters={hasActiveFilters}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          paginationMode="loadMore"
          currentPageLength={pageLength}
          onPageLengthChange={handlePageLengthChange}
          onLoadMore={handleLoadMore}
          toolbarActions={
            selectedKeys.size > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted mr-1">{selectedKeys.size} selected</span>
                {hasDraftSelected && (
                  <Button variant="success" size="sm" onClick={handleBulkSubmit} loading={bulkSubmitting}>
                    <CheckCheck size={13} /> Submit
                  </Button>
                )}
                {hasSubmittedSelected && (
                  <Button variant="danger" size="sm" onClick={handleBulkCancel} loading={bulkCancelling}>
                    <X size={13} /> Cancel
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={handleBulkDelete} loading={bulkDeleting}>
                  <Trash2 size={13} /> Delete
                </Button>
                <Button variant="secondary" size="sm" onClick={handleBulkPrint}>
                  <Printer size={13} /> Print
                </Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <Download size={13} /> Export
              </Button>
            )
          }
        />
      </motion.div>
    </>
  )
}
