"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { DollarSign, FileText, BadgeCheck, AlertCircle, Download, Printer, UserRound, Tag } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Badge, Card, CardContent, ConfirmationDialog, Modal, ModalFooter, Input } from "@/components/ui"
import PaymentTable from "../components/PaymentTable"
import { paymentService, type SalesInvoice, type PaymentEntry, type PaymentEntryListResponse } from "@/services"
import { buildExportFilters, PAYMENT_EXPORT_FIELDS, type PaymentListFilters } from "../services"
import { useMessageDialog, messageFromError, LinkSearchField } from "@/components/ui"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

type StatusFilter = "All" | "Draft" | "Submitted" | "Cancelled"

export default function Payments() {
  const navigate = useNavigate()
  const { showMessage } = useMessageDialog()

  const [unpaidInvoices, setUnpaidInvoices] = useState<SalesInvoice[]>([])
  const [paymentsData, setPaymentsData] = useState<PaymentEntryListResponse | null>(null)
  const [allPayments, setAllPayments] = useState<PaymentEntry[]>([])
  const [loadingUnpaid, setLoadingUnpaid] = useState(true)
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [paymentStart, setPaymentStart] = useState(0)
  const [paymentPageLength, setPaymentPageLength] = useState(20)

  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [acting, setActing] = useState(false)
  const [error] = useState("")
  const [confirmAction, setConfirmAction] = useState<{
    type: "bulk-submit" | "bulk-cancel" | "bulk-delete" | "single-submit" | "single-cancel" | "single-delete" | "single-amend"
    target?: string
  } | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // Filter state
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("All")
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("")
  const [modeFilter, setModeFilter] = useState("")
  const [partyTypeFilter, setPartyTypeFilter] = useState("")
  const [partyTypeOptions, setPartyTypeOptions] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [assigneeFilter, setAssigneeFilter] = useState("")
  const [nameFilter, setNameFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const SORT_STORAGE_KEY = "blesserp_payments_sort"
  const [sortBy, setSortBy] = useState<string>(() => {
    try { return localStorage.getItem(SORT_STORAGE_KEY)?.split("|")[0] || "" } catch { return "" }
  })
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    try { return (localStorage.getItem(SORT_STORAGE_KEY)?.split("|")[1] as "asc" | "desc") || "desc" } catch { return "desc" }
  })

  // Toolbar dialogs (Phase 1: export / print / assign / tags)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<"CSV" | "Excel">("CSV")
  const [exportFields, setExportFields] = useState<Record<string, string[]>>(() =>
    JSON.parse(JSON.stringify(PAYMENT_EXPORT_FIELDS))
  )
  const PRINT_PAGE_SIZES = ["A4", "A3", "A5", "B5", "Letter", "Legal", "Ledger", "Executive"]
  const [printFormats, setPrintFormats] = useState<string[]>([])
  const [printOpen, setPrintOpen] = useState(false)
  const [printFormat, setPrintFormat] = useState("Standard")
  const [printLetterhead, setPrintLetterhead] = useState("")
  const [printPageSize, setPrintPageSize] = useState("A4")
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignee, setAssignee] = useState("")
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tagsInput, setTagsInput] = useState("")
  const [actingToolbar, setActingToolbar] = useState(false)

  useEffect(() => {
    paymentService.getPartyTypes().then((types) => {
      setPartyTypeOptions(types.map((t) => t.name))
    }).catch(() => setPartyTypeOptions([]))
  }, [])

  const fetchUnpaid = useCallback(async () => {
    setLoadingUnpaid(true)
    try {
      const unpaid = await paymentService.getUnpaidInvoices()
      setUnpaidInvoices(unpaid)
    } catch (err) {
      console.error("[Payments] Failed to fetch unpaid invoices:", err)
      setUnpaidInvoices([])
    } finally {
      setLoadingUnpaid(false)
    }
  }, [])

  const fetchPayments = useCallback(async (append = false) => {
    setLoadingPayments(true)
    try {
      const filterParams: PaymentListFilters = {
        start: append ? paymentStart : 0,
        pageLength: paymentPageLength,
      }
      if (activeStatus !== "All") {
        filterParams.status = activeStatus.toLowerCase()
      }
      if (paymentTypeFilter) filterParams.paymentType = paymentTypeFilter
      if (modeFilter) filterParams.modeOfPayment = modeFilter
      if (partyTypeFilter) filterParams.partyType = partyTypeFilter
      if (searchQuery) filterParams.search = searchQuery
      if (assigneeFilter) filterParams.assignedTo = assigneeFilter
      if (nameFilter) filterParams.name = nameFilter
      if (sortBy) {
        filterParams.sortBy = sortBy
        filterParams.sortOrder = sortOrder
      }
      if (dateFrom) filterParams.postingDateFrom = dateFrom
      if (dateTo) filterParams.postingDateTo = dateTo

      const paid = await paymentService.list(filterParams)
      setPaymentsData(paid)
      setAllPayments((prev) => (append ? [...prev, ...paid.items] : paid.items))
      if (!append) setPaymentStart(paymentPageLength)
      else setPaymentStart((s) => s + paymentPageLength)
    } catch (err) {
      console.error("[Payments] Failed to fetch payments:", err)
      setPaymentsData(null)
      setAllPayments([])
      showMessage(messageFromError(err, "Failed to load payments."))
    } finally {
      setLoadingPayments(false)
    }
  }, [paymentStart, paymentPageLength, activeStatus, paymentTypeFilter, modeFilter, partyTypeFilter, searchQuery, assigneeFilter, nameFilter, sortBy, sortOrder, dateFrom, dateTo])

  const fetchData = useCallback(async (append = false) => {
    await Promise.all([fetchUnpaid(), fetchPayments(append)])
  }, [fetchUnpaid, fetchPayments])

  useEffect(() => {
    setPaymentStart(0)
    setAllPayments([])
    fetchData(false)
  }, [activeStatus, paymentTypeFilter, modeFilter, partyTypeFilter, searchQuery, assigneeFilter, nameFilter, sortBy, sortOrder, dateFrom, dateTo, paymentPageLength])

  const overdueCount = unpaidInvoices.filter(
    (inv) => inv.status === "Overdue",
  ).length

  const handleRecordPayment = (inv: SalesInvoice) => {
    navigate(`/payments/new?invoice=${inv.name}`)
  }

  const hasActiveFilters = activeStatus !== "All" || paymentTypeFilter !== "" || modeFilter !== "" || partyTypeFilter !== "" || searchQuery !== "" || assigneeFilter !== "" || nameFilter !== "" || dateFrom !== "" || dateTo !== ""

  const resetFilters = () => {
    setActiveStatus("All")
    setPaymentTypeFilter("")
    setModeFilter("")
    setPartyTypeFilter("")
    setSearchQuery("")
    setAssigneeFilter("")
    setNameFilter("")
    setDateFrom("")
    setDateTo("")
    setPaymentStart(0)
  }

  // Click-to-filter on list values (ERPNext `.filterable` cells): status badge,
  // payment type, and the ID word. Re-clicking the active value toggles it off.
  const handleFilterStatus = useCallback((docstatus: number) => {
    const next: StatusFilter = docstatus === 1 ? "Submitted" : docstatus === 2 ? "Cancelled" : "Draft"
    setActiveStatus((cur) => (cur === next ? "All" : next))
  }, [])

  const handleFilterType = useCallback((type: string) => {
    setPaymentTypeFilter((cur) => (cur === type ? "" : type))
  }, [])

  const handleFilterId = useCallback((name: string) => {
    setNameFilter((cur) => (cur === name ? "" : name))
  }, [])

  const handleLoadMore = useCallback(() => {
    fetchPayments(true)
  }, [fetchPayments])

  const handlePageLengthChange = useCallback((len: number) => {
    setPaymentStart(0)
    setAllPayments([])
    setPaymentPageLength(len)
  }, [])

  // --- Confirmation dialog handling ---
  const getConfirmInfo = () => {
    if (!confirmAction) return { title: "", message: "" }
    const { type, target } = confirmAction
    const count = type.startsWith("bulk-") ? selectedPayments.length : 1
    const name = target ?? ""

    switch (type) {
      case "bulk-submit":
        return { title: `Submit ${count} payments`, message: `Permanently submit ${count} payment(s)? This action cannot be undone.` }
      case "bulk-cancel":
        return { title: `Cancel ${count} payments`, message: `Permanently cancel ${count} payment(s)? This will reverse all GL entries.` }
      case "bulk-delete":
        return { title: `Delete ${count} payments`, message: `Delete ${count} payment(s)? This action cannot be undone.` }
      case "single-submit":
        return { title: "Submit Payment", message: `Permanently submit ${name}? This action cannot be undone.` }
      case "single-cancel":
        return { title: "Cancel Payment", message: `Permanently cancel ${name}? This will reverse all GL entries.` }
      case "single-delete":
        return { title: "Delete Payment", message: `Delete ${name}? This action cannot be undone.` }
      case "single-amend":
        return { title: "Amend Payment", message: `Create a new draft copy of ${name}?` }
      default:
        return { title: "", message: "" }
    }
  }

  const handleConfirm = async () => {
    if (!confirmAction) return
    setActing(true)
    setConfirmError(null)
    try {
      const { type, target } = confirmAction
      const count = selectedPayments.length
      if (type === "bulk-submit") {
        const { failed, enqueued, messages } = await paymentService.bulkSubmit(selectedPayments)
        if (failed.length > 0) {
          const reason = messages.map((m) => m.message).join(" ")
          const detail = reason ? ` — ${reason}` : ""
          throw new Error(`${failed.length} payment entr${failed.length === 1 ? "y" : "ies"} not submitted: ${failed.join(", ")}${detail}`)
        }
        setSelectedPayments([])
        showMessage(enqueued
          ? `Bulk submit queued for ${count} payment entr${count === 1 ? "y" : "ies"} — they will be submitted in the background.`
          : `Submitted ${count} payment entr${count === 1 ? "y" : "ies"}.`)
      } else if (type === "bulk-cancel") {
        const { failed, enqueued, messages } = await paymentService.bulkCancel(selectedPayments)
        if (failed.length > 0) {
          const reason = messages.map((m) => m.message).join(" ")
          const detail = reason ? ` — ${reason}` : ""
          throw new Error(`${failed.length} payment entr${failed.length === 1 ? "y" : "ies"} not canceled: ${failed.join(", ")}${detail}`)
        }
        setSelectedPayments([])
        showMessage(enqueued
          ? `Bulk cancel queued for ${count} payment entr${count === 1 ? "y" : "ies"} — they will be cancelled in the background.`
          : `Canceled ${count} payment entr${count === 1 ? "y" : "ies"}.`)
      } else if (type === "bulk-delete") {
        const { failed, messages } = await paymentService.bulkDelete(selectedPayments)
        if (failed.length > 0) {
          const reason = messages.map((m) => m.message).join(" ")
          const detail = reason ? ` — ${reason}` : ""
          throw new Error(`${failed.length} payment entr${failed.length === 1 ? "y" : "ies"} not deleted: ${failed.join(", ")}${detail}`)
        }
        setSelectedPayments([])
        showMessage(`Deleted ${count} payment entr${count === 1 ? "y" : "ies"}.`)
      } else if (type === "single-submit" && target) {
        await paymentService.submitPayment(target)
        showMessage(`Submitted ${target}.`)
      } else if (type === "single-cancel" && target) {
        await paymentService.cancelPayment(target)
        showMessage(`Canceled ${target}.`)
      } else if (type === "single-delete" && target) {
        await paymentService.deletePayment(target)
        showMessage(`Deleted ${target}.`)
      } else if (type === "single-amend" && target) {
        const original = await paymentService.getById(target)
        navigate("/payments/new", { state: { amendFrom: original } })
      }
      await fetchData()
      setConfirmAction(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed. Please try again."
      setConfirmError(message)
      showMessage(messageFromError(err, message))
      await fetchData()
    } finally {
      setActing(false)
    }
  }

  const confirmInfo = getConfirmInfo()

  // --- Sorting (persisted like ERPNext's list sort) ---
  const handleSort = useCallback((field: string, order: "asc" | "desc") => {
    setSortBy(field)
    setSortOrder(order)
    try { localStorage.setItem(SORT_STORAGE_KEY, `${field}|${order}`) } catch { /* ignore */ }
    setPaymentStart(0)
  }, [])

  // --- Toolbar actions (export / print / assign / tags) ---
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportScopeFilters = (): unknown[] | undefined => {
    if (selectedPayments.length > 0) return [["name", "in", selectedPayments]]
    const current: PaymentListFilters = {}
    if (activeStatus !== "All") current.status = activeStatus.toLowerCase()
    if (paymentTypeFilter) current.paymentType = paymentTypeFilter
    if (modeFilter) current.modeOfPayment = modeFilter
    if (partyTypeFilter) current.partyType = partyTypeFilter
    if (dateFrom) current.postingDateFrom = dateFrom
    if (dateTo) current.postingDateTo = dateTo
    return buildExportFilters(current)
  }

  const toggleExportField = (group: string, field: string) => {
    setExportFields((prev) => {
      const groupFields = prev[group] ?? []
      const has = groupFields.includes(field)
      return {
        ...prev,
        [group]: has ? groupFields.filter((f) => f !== field) : [...groupFields, field],
      }
    })
  }

  const resetExportFields = () => {
    setExportFields(JSON.parse(JSON.stringify(PAYMENT_EXPORT_FIELDS)))
  }

  const handleOpenPrint = () => {
    setPrintOpen(true)
    void paymentService.getPrintFormats().then((formats) => {
      if (formats.length > 0) setPrintFormats(formats)
    })
  }

  const handleBulkExport = async () => {
    setActingToolbar(true)
    try {
      const selectedGroups = Object.fromEntries(
        Object.entries(exportFields).filter(([, fields]) => fields.length > 0)
      )
      if (Object.keys(selectedGroups).length === 0) {
        throw new Error("Select at least one column to export.")
      }
      const blob = await paymentService.exportRecords({
        fileType: exportFormat,
        recordMode: "by_filter",
        fields: selectedGroups,
        filters: exportScopeFilters(),
      })
      downloadBlob(blob, `Payment-Entries.${exportFormat === "CSV" ? "csv" : "xlsx"}`)
      setExportOpen(false)
      showMessage(`Exported ${selectedPayments.length > 0 ? selectedPayments.length : "filtered"} payment entr${selectedPayments.length === 1 ? "y" : "ies"}.`)
    } catch (err) {
      showMessage(messageFromError(err, "Export failed."))
    } finally {
      setActingToolbar(false)
    }
  }

  const handleBulkPrint = () => {
    setPrintOpen(false)
    const url = paymentService.buildMultiPdfUrl(selectedPayments, {
      printFormat,
      letterhead: printLetterhead || undefined,
      pageSize: printPageSize || undefined,
    })
    const preview = window.open(url, "_blank")
    if (!preview) {
      showMessage({ message: "Popup blocked — allow pop-ups to preview and download the PDF.", indicator: "red" })
      return
    }
    showMessage(`Opening PDF preview for ${selectedPayments.length} payment entr${selectedPayments.length === 1 ? "y" : "ies"}.`)
  }

  const handleBulkAssign = async (remove = false) => {
    setAssignOpen(false)
    setActingToolbar(true)
    try {
      if (remove) {
        await paymentService.removeAssignment(selectedPayments)
      } else if (!assignee.trim()) {
        throw new Error("Please enter an assignee.")
      } else {
        await paymentService.assignTo(selectedPayments, assignee.trim())
      }
      showMessage(remove ? "Assignment cleared." : `Assigned ${selectedPayments.length} payment entr${selectedPayments.length === 1 ? "y" : "ies"} to ${assignee.trim()}.`)
      setAssignee("")
    } catch (err) {
      showMessage(messageFromError(err, "Assignment failed."))
    } finally {
      setActingToolbar(false)
    }
  }

  const handleBulkAddTags = async () => {
    setTagsOpen(false)
    setActingToolbar(true)
    try {
      const labels = tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
      if (labels.length === 0) throw new Error("Enter at least one tag.")
      await paymentService.addTags(selectedPayments, labels)
      showMessage(`Added tags to ${selectedPayments.length} payment entr${selectedPayments.length === 1 ? "y" : "ies"}.`)
      setTagsInput("")
    } catch (err) {
      showMessage(messageFromError(err, "Adding tags failed."))
    } finally {
      setActingToolbar(false)
    }
  }

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-heading">Payments</h1>
            <p className="text-sm text-muted mt-1">Record payments and view payment history.</p>
          </div>
          <Button onClick={() => navigate("/payments/new")}>
            <DollarSign size={16} /> New Payment Entry
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <PaymentTable
          data={paymentsData ? { ...paymentsData, items: allPayments } : null}
          loading={loadingPayments}
          onRowClick={(payment) => navigate(`/payments/${payment.name}`)}
          unpaidCount={unpaidInvoices.length}
          overdueCount={overdueCount}
          selectedPayments={selectedPayments}
          onSelectionChange={setSelectedPayments}
          onBulkSubmit={() => setConfirmAction({ type: "bulk-submit" })}
          onBulkCancel={() => setConfirmAction({ type: "bulk-cancel" })}
          onBulkDelete={() => setConfirmAction({ type: "bulk-delete" })}
          onSubmitSingle={(name) => setConfirmAction({ type: "single-submit", target: name })}
          onCancelSingle={(name) => setConfirmAction({ type: "single-cancel", target: name })}
          onDeleteSingle={(name) => setConfirmAction({ type: "single-delete", target: name })}
          onAmendSingle={(name) => setConfirmAction({ type: "single-amend", target: name })}
          activeStatus={activeStatus}
          onStatusFilterChange={(f) => { setActiveStatus(f); setPaymentStart(0) }}
          paymentTypeFilter={paymentTypeFilter}
          onPaymentTypeFilterChange={(v) => { setPaymentTypeFilter(v); setPaymentStart(0) }}
          modeFilter={modeFilter}
          onModeFilterChange={(v) => { setModeFilter(v); setPaymentStart(0) }}
          partyTypeFilter={partyTypeFilter}
          onPartyTypeFilterChange={(v) => { setPartyTypeFilter(v); setPaymentStart(0) }}
          partyTypeOptions={partyTypeOptions}
          searchQuery={searchQuery}
          onSearchQueryChange={(v) => { setSearchQuery(v); setPaymentStart(0) }}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={(v) => { setAssigneeFilter(v); setPaymentStart(0) }}
          nameFilter={nameFilter}
          onFilterId={handleFilterId}
          onFilterType={handleFilterType}
          onFilterStatus={handleFilterStatus}
          onBulkExport={() => setExportOpen(true)}
          onBulkPrint={handleOpenPrint}
          onBulkAssign={() => { setAssignee(""); setAssignOpen(true) }}
          onBulkAddTags={() => { setTagsInput(""); setTagsOpen(true) }}
          sortField={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSort}
          dateFrom={dateFrom}
          onDateFromChange={(v) => { setDateFrom(v); setPaymentStart(0) }}
          dateTo={dateTo}
          onDateToChange={(v) => { setDateTo(v); setPaymentStart(0) }}
          onResetFilters={resetFilters}
          hasActiveFilters={hasActiveFilters}
          paginationMode="loadMore"
          currentPageLength={paymentPageLength}
          onPageLengthChange={handlePageLengthChange}
          onLoadMore={handleLoadMore}
        />

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-heading">Unpaid Invoices</h2>
            {unpaidInvoices.length > 0 && (
              <Badge variant="warning">{unpaidInvoices.length} pending</Badge>
            )}
          </div>

          {loadingUnpaid ? (
            <div className="bg-surface rounded-[16px] border border-border shadow-card p-8">
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-[12px]" />
                ))}
              </div>
            </div>
          ) : unpaidInvoices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-12 h-12 rounded-[14px] bg-success-50 text-success-600 flex items-center justify-center mx-auto mb-4">
                  <BadgeCheck size={24} />
                </div>
                <p className="font-semibold text-heading">All caught up!</p>
                <p className="text-sm text-muted mt-1">No unpaid invoices at this time.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead>
                    <tr className="bg-gray-50/50">
                      {["Invoice", "Date", "Due", "Amount", "Status", ""].map((h) => (
                        <th
                          key={h}
                          className={cn(
                            "px-6 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider",
                            h === "Amount" || h === "" ? "text-right" : "text-left",
                            h === "Date" && "hidden lg:table-cell",
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {unpaidInvoices.map((inv) => (
                      <tr key={inv.name} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
                              <FileText size={16} />
                            </div>
                            <div>
                              <p className="font-semibold text-heading">{inv.name}</p>
                              <p className="text-xs text-muted">{inv.customer_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted hidden lg:table-cell">
                          {formatDate(inv.posting_date)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("text-sm", inv.status === "Overdue" ? "text-danger-600 font-semibold" : "text-muted")}>
                            {formatDate(inv.due_date)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold tabular-nums text-heading">
                          {formatCurrency(inv.outstanding_amount)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={inv.status === "Overdue" ? "danger" : "info"}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="success" size="sm" onClick={() => handleRecordPayment(inv)}>
                            <DollarSign size={13} /> Record Payment
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      </motion.div>

      {/* Confirmation dialog */}
      <ConfirmationDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null)
            setConfirmError(null)
          }
        }}
        onConfirm={handleConfirm}
        title={confirmInfo.title}
        description={confirmInfo.message}
        confirmLabel={confirmAction?.type.includes("submit") ? "Submit" : confirmAction?.type.includes("cancel") ? "Cancel Payment" : confirmAction?.type.includes("amend") ? "Amend" : "Delete"}
        cancelLabel="No, go back"
        variant={confirmAction?.type.includes("delete") || confirmAction?.type.includes("cancel") ? "danger" : "warning"}
        loading={acting}
        error={confirmError}
      />

      {/* Export dialog */}
      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Payment Entries"
        description={`Export ${selectedPayments.length > 0 ? `${selectedPayments.length} selected` : "all filtered"} payment entr${selectedPayments.length === 1 ? "y" : "ies"}.`}
      >
        <label className="block text-xs font-semibold text-muted mb-1.5">Format</label>
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as "CSV" | "Excel")}
          className="w-full h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        >
          <option value="CSV">CSV (.csv)</option>
          <option value="Excel">Excel (.xlsx)</option>
        </select>
        <div className="mt-4 flex items-center justify-between">
          <label className="text-xs font-semibold text-muted mb-1.5 block">Columns</label>
          <button
            type="button"
            onClick={resetExportFields}
            className="text-xs text-primary-600 hover:underline"
          >
            Reset to all
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto pr-1 space-y-3 mt-1">
          {Object.entries(PAYMENT_EXPORT_FIELDS).map(([group, fields]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-body mb-1.5">
                {group === "Payment Entry" ? "Payment Entry" : "References (child table)"}
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {fields.map((field) => {
                  const checked = (exportFields[group] ?? []).includes(field)
                  return (
                    <label key={field} className="flex items-center gap-2 text-sm text-body cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExportField(group, field)}
                        className="accent-primary-600"
                      />
                      <span className="capitalize">{field.replace(/_/g, " ")}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkExport} loading={actingToolbar}>
            <Download size={14} /> Export
          </Button>
        </ModalFooter>
      </Modal>

      {/* Print dialog */}
      <Modal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Print Payment Entries"
        description={`Generate a PDF preview for ${selectedPayments.length} selected payment entr${selectedPayments.length === 1 ? "y" : "ies"}. A new tab opens with the PDF — download it from there (mirrors ERPNext).`}
      >
        <label className="block text-xs font-semibold text-muted mb-1.5">Print Format</label>
        <select
          value={printFormat}
          onChange={(e) => setPrintFormat(e.target.value)}
          className="w-full h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        >
          {printFormats.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <label className="block text-xs font-semibold text-muted mb-1.5 mt-3">Page Size</label>
        <select
          value={printPageSize}
          onChange={(e) => setPrintPageSize(e.target.value)}
          className="w-full h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        >
          {PRINT_PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <label className="block text-xs font-semibold text-muted mb-1.5 mt-3">Letterhead</label>
        <Input
          value={printLetterhead}
          onChange={(e) => setPrintLetterhead(e.target.value)}
          placeholder="Leave blank for no letterhead"
          className="w-full"
        />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setPrintOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkPrint}>
            <Printer size={14} /> Preview
          </Button>
        </ModalFooter>
      </Modal>

      {/* Assign dialog */}
      <Modal
        open={assignOpen}
        onClose={() => {
          setAssignOpen(false)
          setAssignee("")
        }}
        title="Assign Payment Entries"
        description={`Assign ${selectedPayments.length} selected payment entr${selectedPayments.length === 1 ? "y" : "ies"} to a user, or clear the current assignment.`}
      >
        <LinkSearchField
          value={assignee || undefined}
          onChange={(v) => setAssignee(v ?? "")}
          searchFn={(query) =>
            paymentService.searchAssignableUsers(query).then((users) => ({
              items: users.map((u) => ({ value: u.value, label: u.label, description: u.description })),
            }))
          }
          placeholder="Type to search users..."
          required
          className="w-full"
          clearIconMode="hover"
        />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
          <Button
            variant="ghost"
            className="text-danger-600 border border-danger-100 bg-danger-50 hover:bg-danger-100"
            onClick={() => handleBulkAssign(true)}
            loading={actingToolbar}
          >
            <UserRound size={14} /> Remove
          </Button>
          <Button onClick={() => handleBulkAssign(false)} loading={actingToolbar}>
            <UserRound size={14} /> Assign
          </Button>
        </ModalFooter>
      </Modal>

      {/* Tags dialog */}
      <Modal
        open={tagsOpen}
        onClose={() => {
          setTagsOpen(false)
          setTagsInput("")
        }}
        title="Add Tags"
        description={`Add tags to ${selectedPayments.length} selected payment entr${selectedPayments.length === 1 ? "y" : "ies"}. Separate tags with commas.`}
      >
        <Input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. Audit, Q1-Review, Priority"
          className="w-full"
        />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setTagsOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkAddTags} loading={actingToolbar}>
            <Tag size={14} /> Add Tags
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
