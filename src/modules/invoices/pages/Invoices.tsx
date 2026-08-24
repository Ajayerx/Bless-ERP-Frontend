"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, CheckCheck, X, Printer, Download, Trash2, UserRound, Tag } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, useToast, Modal, ModalFooter, Input, ListBulkActions } from "@/components/ui"
import { useMessageDialog, messageFromError, LinkSearchField } from "@/components/ui"
import { invoiceService, type SalesInvoice, type SalesInvoiceListResponse } from "@/services"
import { INVOICE_EXPORT_FIELDS } from "../services"
import InvoiceTable from "../components/InvoiceTable"

type StatusFilter = "All" | "Paid" | "Unpaid" | "Overdue" | "Draft" | "Cancelled"

const MESSAGE_DIVIDER = '<hr class="my-2 border-0 border-t border-gray-200" />'

export default function Invoices() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { showMessage } = useMessageDialog()
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
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignee, setAssignee] = useState("")
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tagsInput, setTagsInput] = useState("")
  const [actingToolbar, setActingToolbar] = useState(false)

  // Export dialog
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<"CSV" | "Excel">("CSV")
  const [exportFields, setExportFields] = useState<Record<string, string[]>>(() =>
    JSON.parse(JSON.stringify(INVOICE_EXPORT_FIELDS))
  )

  // Filter state
  const [customerSearch, setCustomerSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [assigneeFilter, setAssigneeFilter] = useState("")
  const [nameFilter, setNameFilter] = useState("")

  const INVOICE_SORT_STORAGE_KEY = "blesserp_invoices_sort"
  const [sortBy, setSortBy] = useState<string>(() => {
    try { return localStorage.getItem(INVOICE_SORT_STORAGE_KEY)?.split("|")[0] || "" } catch { return "" }
  })
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    try { return (localStorage.getItem(INVOICE_SORT_STORAGE_KEY)?.split("|")[1] as "asc" | "desc") || "desc" } catch { return "desc" }
  })

  const handleSort = (field: string, order: "asc" | "desc") => {
    setSortBy(field)
    setSortOrder(order)
    try { localStorage.setItem(INVOICE_SORT_STORAGE_KEY, `${field}|${order}`) } catch { /* ignore */ }
    setStart(0)
  }

  const handleFilterId = (name: string) => {
    setNameFilter((cur) => (cur === name ? "" : name))
    setStart(0)
  }

  const hasActiveFilters =
    customerSearch !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    assigneeFilter !== "" ||
    nameFilter !== "" ||
    activeFilter !== "All" ||
    sortBy !== ""

  const resetFilters = () => {
    setCustomerSearch("")
    setDateFrom("")
    setDateTo("")
    setAssigneeFilter("")
    setNameFilter("")
    setActiveFilter("All")
    setSortBy("")
    setSortOrder("desc")
    try { localStorage.removeItem(INVOICE_SORT_STORAGE_KEY) } catch { /* ignore */ }
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
        assignedTo: assigneeFilter || undefined,
        name: nameFilter || undefined,
        sortBy: sortBy || undefined,
        sortOrder,
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
  }, [customerSearch, start, pageLength, activeFilter, dateFrom, dateTo, assigneeFilter, nameFilter, sortBy, sortOrder])

  useEffect(() => {
    setStart(0)
    fetchData(false)
  }, [customerSearch, activeFilter, dateFrom, dateTo, pageLength, assigneeFilter, nameFilter, sortBy, sortOrder])

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

  const hasCancelledSelected = useMemo(
    () => selectedItems.some((inv) => inv.docstatus === 2),
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
      const { failed, enqueued, messages } = await invoiceService.bulkSubmit(names)
      if (failed.length > 0) {
        const reason = messages.map((m) => m.message).join(MESSAGE_DIVIDER)
        const detail = reason ? `\n${reason}` : ""
        throw new Error(`${failed.length} invoice${failed.length === 1 ? "" : "s"} not submitted: ${failed.join(", ")}${detail}`)
      }
      addToast(enqueued
        ? `Submitted ${names.length} invoice${names.length > 1 ? "s" : ""} queued in the background`
        : `Submitted ${names.length} invoice${names.length > 1 ? "s" : ""} successfully`, "success")
      setSelectedKeys(new Set())
      setStart(0)
      fetchData()
    } catch (e) {
      showMessage(messageFromError(e, "Bulk submit failed"))
    } finally {
      setBulkSubmitting(false)
    }
  }

  const handleBulkCancel = async () => {
    const names = Array.from(selectedKeys)
    setBulkCancelling(true)
    setError("")
    try {
      const { failed, enqueued, messages } = await invoiceService.bulkCancel(names)
      if (failed.length > 0) {
        const reason = messages.map((m) => m.message).join(MESSAGE_DIVIDER)
        const detail = reason ? `\n${reason}` : ""
        throw new Error(`${failed.length} invoice${failed.length === 1 ? "" : "s"} not cancelled: ${failed.join(", ")}${detail}`)
      }
      addToast(enqueued
        ? `Cancelled ${names.length} invoice${names.length > 1 ? "s" : ""} queued in the background`
        : `Cancelled ${names.length} invoice${names.length > 1 ? "s" : ""} successfully`, "success")
      setSelectedKeys(new Set())
      setStart(0)
      fetchData()
    } catch (e) {
      showMessage(messageFromError(e, "Bulk cancel failed"))
    } finally {
      setBulkCancelling(false)
    }
  }

  const handleBulkDelete = async () => {
    const names = Array.from(selectedKeys)
    setBulkDeleting(true)
    setError("")
    try {
      const { failed, messages } = await invoiceService.bulkDelete(names)
      if (failed.length > 0) {
        const reason = messages.map((m) => m.message).join(MESSAGE_DIVIDER)
        const detail = reason ? `\n${reason}` : ""
        throw new Error(`${failed.length} invoice${failed.length === 1 ? "" : "s"} not deleted: ${failed.join(", ")}${detail}`)
      }
      addToast(`Deleted ${names.length} invoice${names.length > 1 ? "s" : ""} successfully`, "success")
      setSelectedKeys(new Set())
      setStart(0)
      fetchData()
    } catch (e) {
      showMessage(messageFromError(e, "Bulk delete failed"))
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleBulkPrint = () => {
    // Cancelled invoices are blocked by Frappe's printview (403), and
    // download_multi_pdf skips docs it cannot render — drop them up front so
    // the user knows why the merged PDF may be shorter than the selection.
    const docstatusByName = new Map(allItems.map((inv) => [inv.name, inv.docstatus]))
    const names = Array.from(selectedKeys)
    const printable = names.filter((name) => docstatusByName.get(name) !== 2)
    const skipped = names.length - printable.length
    if (skipped > 0) {
      showMessage(`Skipped ${skipped} cancelled invoice${skipped === 1 ? "" : "s"} — cancelled documents cannot be printed.`)
    }
    if (printable.length === 0) return
    window.open(invoiceService.buildMultiPdfUrl(printable), "_blank")
  }

  const handleBulkAssign = async (remove = false) => {
    const names = Array.from(selectedKeys)
    setAssignOpen(false)
    setActingToolbar(true)
    try {
      if (remove) {
        await invoiceService.removeAssignment(names)
      } else if (!assignee.trim()) {
        throw new Error("Please enter an assignee.")
      } else {
        await invoiceService.assignTo(names, assignee.trim())
      }
      showMessage(remove ? "Assignment cleared." : `Assigned ${names.length} invoice${names.length === 1 ? "" : "s"} to ${assignee.trim()}.`)
      setAssignee("")
    } catch (err) {
      showMessage(messageFromError(err, "Assignment failed."))
    } finally {
      setActingToolbar(false)
    }
  }

  const handleBulkAddTags = async () => {
    const names = Array.from(selectedKeys)
    setTagsOpen(false)
    setActingToolbar(true)
    try {
      const labels = tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
      if (labels.length === 0) throw new Error("Please enter at least one tag.")
      await invoiceService.addTags(names, labels)
      showMessage(`Added ${labels.length} tag${labels.length === 1 ? "" : "s"} to ${names.length} invoice${names.length === 1 ? "" : "s"}.`)
      setTagsInput("")
    } catch (err) {
      showMessage(messageFromError(err, "Adding tags failed."))
    } finally {
      setActingToolbar(false)
    }
  }

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
    if (selectedKeys.size > 0) return [["name", "in", Array.from(selectedKeys)]]
    const filters: unknown[] = []
    if (activeFilter !== "All") {
      const statusMap: Record<string, string> = {
        paid: "Paid", unpaid: "Unpaid", overdue: "Overdue",
        draft: "Draft", cancelled: "Cancelled", submitted: "Submitted",
      }
      filters.push(["status", "=", statusMap[activeFilter.toLowerCase()] || activeFilter])
    }
    if (dateFrom) filters.push(["posting_date", ">=", dateFrom])
    if (dateTo) filters.push(["posting_date", "<=", dateTo])
    if (assigneeFilter) filters.push(["_assign", "like", `%${assigneeFilter}%`])
    if (nameFilter) filters.push(["name", "=", nameFilter])
    return filters.length > 0 ? filters : undefined
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
    setExportFields(JSON.parse(JSON.stringify(INVOICE_EXPORT_FIELDS)))
  }

  const handleExport = async () => {
    setActingToolbar(true)
    try {
      const selectedGroups = Object.fromEntries(
        Object.entries(exportFields).filter(([, fields]) => fields.length > 0)
      )
      if (Object.keys(selectedGroups).length === 0) {
        throw new Error("Select at least one column to export.")
      }
      const blob = await invoiceService.exportRecords({
        fileType: exportFormat,
        recordMode: "by_filter",
        fields: selectedGroups,
        filters: exportScopeFilters(),
      })
      downloadBlob(blob, `Sales-Invoices.${exportFormat === "CSV" ? "csv" : "xlsx"}`)
      setExportOpen(false)
      showMessage(`Exported ${selectedKeys.size > 0 ? selectedKeys.size : "filtered"} invoices.`)
    } catch (err) {
      showMessage(messageFromError(err, "Export failed."))
    } finally {
      setActingToolbar(false)
    }
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
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-[14px] text-sm text-danger-700 whitespace-pre-line">
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
          assignedTo={assigneeFilter}
          onAssigneeFilterChange={(v) => { setAssigneeFilter(v); setStart(0) }}
          nameFilter={nameFilter}
          onFilterId={handleFilterId}
          sortField={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSort}
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
            <ListBulkActions
              count={selectedKeys.size}
              noun="invoices"
              fallback={
                <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
                  <Download size={13} /> Export
                </Button>
              }
              items={[
                {
                  label: "Submit",
                  icon: <CheckCheck size={14} />,
                  show: hasDraftSelected,
                  disabled: bulkSubmitting,
                  onClick: handleBulkSubmit,
                },
                {
                  label: "Cancel",
                  icon: <X size={14} />,
                  show: hasSubmittedSelected,
                  disabled: bulkCancelling,
                  danger: true,
                  onClick: handleBulkCancel,
                },
                {
                  label: "Delete",
                  icon: <Trash2 size={14} />,
                  show: hasDraftSelected || hasCancelledSelected,
                  disabled: bulkDeleting,
                  danger: true,
                  onClick: handleBulkDelete,
                },
                {
                  label: "Export",
                  icon: <Download size={14} />,
                  separatorBefore: true,
                  onClick: () => setExportOpen(true),
                },
                {
                  label: "Print",
                  icon: <Printer size={14} />,
                  onClick: handleBulkPrint,
                },
                {
                  label: "Assign to…",
                  icon: <UserRound size={14} />,
                  onClick: () => setAssignOpen(true),
                },
                {
                  label: "Clear Assignment",
                  icon: <UserRound size={14} />,
                  onClick: () => handleBulkAssign(true),
                },
                {
                  label: "Add Tags",
                  icon: <Tag size={14} />,
                  onClick: () => setTagsOpen(true),
                },
              ]}
            />
          }
        />

        {/* Assign dialog */}
        <Modal
          open={assignOpen}
          onClose={() => {
            setAssignOpen(false)
            setAssignee("")
          }}
          title="Assign Invoices"
          description={`Assign ${selectedKeys.size} selected invoice${selectedKeys.size === 1 ? "" : "s"} to a user, or clear the current assignment.`}
        >
          <LinkSearchField
            value={assignee || undefined}
            onChange={(v) => setAssignee(v ?? "")}
            searchFn={(query) =>
              invoiceService.searchAssignableUsers(query).then((users) => ({
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
          description={`Add tags to ${selectedKeys.size} selected invoice${selectedKeys.size === 1 ? "" : "s"}. Separate tags with commas.`}
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

        {/* Export dialog */}
        <Modal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          title="Export Sales Invoices"
          description={`Export ${selectedKeys.size > 0 ? `${selectedKeys.size} selected` : "all filtered"} invoices.`}
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
            {Object.entries(INVOICE_EXPORT_FIELDS).map(([group, fields]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-body mb-1.5">
                  {group === "Sales Invoice" ? "Sales Invoice" : "Items (child table)"}
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
            <Button onClick={handleExport} loading={actingToolbar}>
              <Download size={14} /> Export
            </Button>
          </ModalFooter>
        </Modal>
      </motion.div>
    </>
  )
}
