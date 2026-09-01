"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Download, Printer, UserRound } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Modal, ModalFooter, Input, ConfirmationDialog } from "@/components/ui"
import { useMessageDialog, messageFromError, LinkSearchField } from "@/components/ui"
import { quotationService, QUOTATION_EXPORT_FIELDS, type Quotation, type QuotationListResponse } from "@/services"
import QuotationTable from "../components/QuotationTable"

const QUOTATION_SORT_STORAGE_KEY = "blesserp_quotations_sort"
const MESSAGE_DIVIDER = '<hr class="my-2 border-0 border-t border-gray-200" />'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Quotations() {
  const navigate = useNavigate()
  const { showMessage } = useMessageDialog()
  const [data, setData] = useState<QuotationListResponse | null>(null)
  const [allItems, setAllItems] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [start, setStart] = useState(0)
  const [pageLength, setPageLength] = useState(20)
  const [activeFilter, setActiveFilter] = useState("All")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkLoading] = useState(false)
  const [actingToolbar, setActingToolbar] = useState(false)

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    type: "bulk-submit" | "bulk-cancel" | "bulk-delete" | "single-submit" | "single-cancel" | "single-delete" | "single-amend"
    target?: string
  } | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignee, setAssignee] = useState("")
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tagsInput, setTagsInput] = useState("")

  // Export dialog
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<"CSV" | "Excel">("CSV")
  const [exportFields, setExportFields] = useState<Record<string, string[]>>(JSON.parse(JSON.stringify(QUOTATION_EXPORT_FIELDS)))

  // Print dialog
  const [printOpen, setPrintOpen] = useState(false)
  const [printFormat, setPrintFormat] = useState("Standard")
  const [printLetterhead, setPrintLetterhead] = useState("")
  const [printPageSize, setPrintPageSize] = useState("")
  const [printFormats, setPrintFormats] = useState<string[]>(["Standard"])

  // Filter state
  const [customerSearch, setCustomerSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [validTillFrom, setValidTillFrom] = useState("")
  const [validTillTo, setValidTillTo] = useState("")
  const [assigneeFilter, setAssigneeFilter] = useState("")

  const [sortBy, setSortBy] = useState<string>(() => {
    try {
      return localStorage.getItem(QUOTATION_SORT_STORAGE_KEY)?.split("|")[0] || ""
    } catch {
      return ""
    }
  })
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    try {
      return (localStorage.getItem(QUOTATION_SORT_STORAGE_KEY)?.split("|")[1] as "asc" | "desc") || "desc"
    } catch {
      return "desc"
    }
  })

  const handleSort = (field: string, order: "asc" | "desc") => {
    setSortBy(field)
    setSortOrder(order)
    try {
      localStorage.setItem(QUOTATION_SORT_STORAGE_KEY, `${field}|${order}`)
    } catch {
      // ignore
    }
    setStart(0)
  }

  const hasActiveFilters =
    customerSearch !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    validTillFrom !== "" ||
    validTillTo !== "" ||
    assigneeFilter !== "" ||
    activeFilter !== "All" ||
    sortBy !== ""

  const resetFilters = () => {
    setCustomerSearch("")
    setDateFrom("")
    setDateTo("")
    setValidTillFrom("")
    setValidTillTo("")
    setAssigneeFilter("")
    setActiveFilter("All")
    setSortBy("")
    setSortOrder("desc")
    try {
      localStorage.removeItem(QUOTATION_SORT_STORAGE_KEY)
    } catch {
      // ignore
    }
    setStart(0)
  }

  const fetchData = useCallback(
    async (append = false) => {
      setLoading(true)
      setError("")
      try {
        const result = await quotationService.list({
          search: customerSearch,
          page: Math.floor((append ? start : 0) / pageLength) + 1,
          pageSize: pageLength,
          status: activeFilter === "All" ? undefined : activeFilter,
          transactionDateFrom: dateFrom || undefined,
          transactionDateTo: dateTo || undefined,
          validTillFrom: validTillFrom || undefined,
          validTillTo: validTillTo || undefined,
          assignedTo: assigneeFilter || undefined,
          sortBy: sortBy || undefined,
          sortOrder,
        })
        setData(result)
        setAllItems(result.items)
        if (!append) setStart(pageLength)
        else setStart((s) => s + pageLength)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load quotations")
      } finally {
        setLoading(false)
      }
    },
    [
      customerSearch,
      start,
      pageLength,
      activeFilter,
      dateFrom,
      dateTo,
      validTillFrom,
      validTillTo,
      assigneeFilter,
      sortBy,
      sortOrder,
    ]
  )

  useEffect(() => {
    setStart(0)
    fetchData(false)
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    customerSearch,
    activeFilter,
    dateFrom,
    dateTo,
    validTillFrom,
    validTillTo,
    pageLength,
    assigneeFilter,
    sortBy,
    sortOrder,
  ])

  const handleLoadMore = () => {
    fetchData(true)
  }

  const handlePageLengthChange = (size: number) => {
    setPageLength(size)
  }

  const selectedItems = useMemo(() => {
    return allItems.filter((q) => selectedKeys.has(q.name))
  }, [allItems, selectedKeys])

  const hasDraftSelected = useMemo(() => selectedItems.some((q) => q.docstatus === 0), [selectedItems])
  const hasSubmittedSelected = useMemo(() => selectedItems.some((q) => q.docstatus === 1), [selectedItems])
  const hasCancelledSelected = useMemo(() => selectedItems.some((q) => q.docstatus === 2), [selectedItems])

  // ── Confirmation dialog info ────────────────────────────────────────
  const confirmInfo = useMemo(() => {
    if (!confirmAction) return { title: "", message: "" }
    const { type, target } = confirmAction
    const count = type.startsWith("bulk-") ? selectedKeys.size : 1
    const name = target ?? ""
    switch (type) {
      case "bulk-submit":
        return { title: `Submit ${count} quotations`, message: `Permanently submit ${count} quotation(s)? This action cannot be undone.` }
      case "bulk-cancel":
        return { title: `Cancel ${count} quotations`, message: `Permanently cancel ${count} quotation(s)? This will reverse all GL entries.` }
      case "bulk-delete":
        return { title: `Delete ${count} quotations`, message: `Delete ${count} quotation(s)? This action cannot be undone.` }
      case "single-submit":
        return { title: "Submit Quotation", message: `Permanently submit ${name}? This action cannot be undone.` }
      case "single-cancel":
        return { title: "Cancel Quotation", message: `Permanently cancel ${name}? This will reverse all GL entries.` }
      case "single-delete":
        return { title: "Delete Quotation", message: `Delete ${name}? This action cannot be undone.` }
      case "single-amend":
        return { title: "Amend Quotation", message: `Create a new draft copy of ${name}?` }
      default:
        return { title: "", message: "" }
    }
  }, [confirmAction, selectedKeys.size])

  // ── Confirm handler ─────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!confirmAction) return
    setActing(true)
    setConfirmError(null)
    try {
      const { type, target } = confirmAction
      const count = selectedKeys.size
      if (type === "bulk-submit") {
        const { failed, enqueued, messages } = await quotationService.bulkSubmit(Array.from(selectedKeys))
        if (failed.length > 0) {
          const reason = messages.map((m) => m.message).join(MESSAGE_DIVIDER)
          const detail = reason ? `\n${reason}` : ""
          throw new Error(`${failed.length} quotation${failed.length === 1 ? "" : "s"} not submitted: ${failed.join(", ")}${detail}`)
        }
        setSelectedKeys(new Set())
        showMessage(enqueued
          ? `Bulk submit queued for ${count} quotation${count === 1 ? "" : "s"} — they will be submitted in the background.`
          : `Submitted ${count} quotation${count === 1 ? "" : "s"}.`)
      } else if (type === "bulk-cancel") {
        const { failed, enqueued, messages } = await quotationService.bulkCancel(Array.from(selectedKeys))
        if (failed.length > 0) {
          const reason = messages.map((m) => m.message).join(MESSAGE_DIVIDER)
          const detail = reason ? `\n${reason}` : ""
          throw new Error(`${failed.length} quotation${failed.length === 1 ? "" : "s"} not canceled: ${failed.join(", ")}${detail}`)
        }
        setSelectedKeys(new Set())
        showMessage(enqueued
          ? `Bulk cancel queued for ${count} quotation${count === 1 ? "" : "s"} — they will be cancelled in the background.`
          : `Canceled ${count} quotation${count === 1 ? "" : "s"}.`)
      } else if (type === "bulk-delete") {
        const { failed, messages } = await quotationService.bulkDelete(Array.from(selectedKeys))
        if (failed.length > 0) {
          const reason = messages.map((m) => m.message).join(MESSAGE_DIVIDER)
          const detail = reason ? `\n${reason}` : ""
          throw new Error(`${failed.length} quotation${failed.length === 1 ? "" : "s"} not deleted: ${failed.join(", ")}${detail}`)
        }
        setSelectedKeys(new Set())
        showMessage(`Deleted ${count} quotation${count === 1 ? "" : "s"}.`)
      } else if (type === "single-submit" && target) {
        await quotationService.submitDoc(target)
        showMessage(`Submitted ${target}.`)
      } else if (type === "single-cancel" && target) {
        await quotationService.cancelDoc(target)
        showMessage(`Canceled ${target}.`)
      } else if (type === "single-delete" && target) {
        await quotationService.delete(target)
        showMessage(`Deleted ${target}.`)
      } else if (type === "single-amend" && target) {
        const original = await quotationService.getById(target)
        navigate("/quotations/new", { state: { amendFrom: original } })
        return
      }
      setConfirmAction(null)
      setStart(0)
      fetchData()
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setActing(false)
    }
  }

  // ── Export helpers ──────────────────────────────────────────────────
  const toggleExportField = (group: string, field: string) => {
    setExportFields((prev) => {
      const next = { ...prev, [group]: [...(prev[group] ?? [])] }
      const idx = next[group].indexOf(field)
      if (idx >= 0) next[group].splice(idx, 1)
      else next[group].push(field)
      return next
    })
  }

  const resetExportFields = () => {
    setExportFields(JSON.parse(JSON.stringify(QUOTATION_EXPORT_FIELDS)))
  }

  const buildExportFilters = (): unknown[] | undefined => {
    const filters: unknown[] = []
    if (activeFilter !== "All") filters.push(["status", "=", activeFilter])
    if (customerSearch) filters.push(["party_name", "like", `%${customerSearch}%`])
    if (dateFrom) filters.push(["transaction_date", ">=", dateFrom])
    if (dateTo) filters.push(["transaction_date", "<=", dateTo])
    if (validTillFrom) filters.push(["valid_till", ">=", validTillFrom])
    if (validTillTo) filters.push(["valid_till", "<=", validTillTo])
    if (assigneeFilter) filters.push(["_assign", "like", `%${assigneeFilter}%`])
    return filters.length > 0 ? filters : undefined
  }

  const exportScopeFilters = (): unknown[] | undefined => {
    if (selectedKeys.size > 0) return [["name", "in", Array.from(selectedKeys)]]
    return buildExportFilters()
  }

  const handleBulkExport = async () => {
    setActingToolbar(true)
    try {
      const activeGroups = Object.entries(exportFields).filter(([, fields]) => fields.length > 0)
      const fields = Object.fromEntries(activeGroups)
      const blob = await quotationService.exportRecords({
        fileType: exportFormat,
        recordMode: "by_filter",
        fields: Object.keys(fields).length > 0 ? fields : undefined,
        filters: exportScopeFilters(),
      })
      downloadBlob(blob, `Quotations.${exportFormat === "Excel" ? "xlsx" : "csv"}`)
      setExportOpen(false)
      showMessage("Export complete.")
    } catch (err) {
      showMessage(messageFromError(err, "Export failed"))
    } finally {
      setActingToolbar(false)
    }
  }

  // ── Print helpers ───────────────────────────────────────────────────
  const handleOpenPrint = async () => {
    try {
      const formats = await quotationService.getPrintFormats()
      setPrintFormats(formats)
    } catch { /* ignore */ }
    setPrintOpen(true)
  }

  const handleBulkPrint = () => {
    const printable = Array.from(selectedKeys)
    if (printable.length === 0) return
    const url = quotationService.buildMultiPdfUrl(printable, {
      printFormat,
      letterhead: printLetterhead || undefined,
      pageSize: printPageSize || undefined,
    })
    const preview = window.open(url, "_blank")
    if (!preview) showMessage("Pop-up blocked — please allow pop-ups for this site.")
    setPrintOpen(false)
  }

  // ── Bulk assign / tags (unchanged logic) ────────────────────────────
  const handleBulkAssign = async (remove = false) => {
    const names = Array.from(selectedKeys)
    setAssignOpen(false)
    setActingToolbar(true)
    try {
      if (remove) {
        await quotationService.removeAssignment(names)
      } else if (!assignee.trim()) {
        throw new Error("Please enter an assignee.")
      } else {
        await quotationService.assignTo(names, assignee.trim())
      }
      showMessage(remove ? "Assignment cleared." : `Assigned ${names.length} quotation${names.length === 1 ? "" : "s"} to ${assignee.trim()}.`)
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
      const labels = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
      if (labels.length === 0) throw new Error("Please enter at least one tag.")
      for (const name of names) {
        for (const label of labels) {
          await quotationService.addTagToDoc(name, label)
        }
      }
      showMessage(`Added ${labels.length} tag${labels.length === 1 ? "" : "s"} to ${names.length} quotation${names.length === 1 ? "" : "s"}.`)
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
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Quotations</h1>
            <p className="text-sm text-muted mt-1">Create and manage customer quotations.</p>
          </div>
          <Button onClick={() => navigate("/quotations/new")}>
            <Plus size={16} />
            New Quotation
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-[14px] text-sm text-danger-700 whitespace-pre-line">
            {error}
          </div>
        )}

        <QuotationTable
          data={data}
          loading={loading || bulkLoading}
          page={Math.floor(start / pageLength) + 1}
          onPageChange={() => {}}
          activeFilter={activeFilter}
          onFilterChange={(f) => {
            setActiveFilter(f)
            setStart(0)
          }}
          onRowClick={(quotation) => navigate(`/quotations/${quotation.name}`)}
          customerSearch={customerSearch}
          onCustomerSearchChange={(v) => {
            setCustomerSearch(v)
            setStart(0)
          }}
          dateFrom={dateFrom}
          onDateFromChange={(v) => {
            setDateFrom(v)
            setStart(0)
          }}
          dateTo={dateTo}
          onDateToChange={(v) => {
            setDateTo(v)
            setStart(0)
          }}
          validTillFrom={validTillFrom}
          onValidTillFromChange={(v) => {
            setValidTillFrom(v)
            setStart(0)
          }}
          validTillTo={validTillTo}
          onValidTillToChange={(v) => {
            setValidTillTo(v)
            setStart(0)
          }}
          assignedTo={assigneeFilter}
          onAssigneeFilterChange={(v) => {
            setAssigneeFilter(v)
            setStart(0)
          }}
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
          hasDraftSelected={hasDraftSelected}
          hasSubmittedSelected={hasSubmittedSelected}
          hasCancelledSelected={hasCancelledSelected}
          onSubmitSingle={(name) => setConfirmAction({ type: "single-submit", target: name })}
          onCancelSingle={(name) => setConfirmAction({ type: "single-cancel", target: name })}
          onDeleteSingle={(name) => setConfirmAction({ type: "single-delete", target: name })}
          onAmendSingle={(name) => setConfirmAction({ type: "single-amend", target: name })}
          onBulkSubmit={() => setConfirmAction({ type: "bulk-submit" })}
          onBulkCancel={() => setConfirmAction({ type: "bulk-cancel" })}
          onBulkDelete={() => setConfirmAction({ type: "bulk-delete" })}
          onBulkExport={() => setExportOpen(true)}
          onBulkPrint={handleOpenPrint}
          onBulkAssign={() => { setAssignee(""); setAssignOpen(true) }}
          onBulkClearAssign={() => handleBulkAssign(true)}
          onBulkAddTags={() => { setTagsInput(""); setTagsOpen(true) }}
        />

        <Modal
          open={assignOpen}
          onClose={() => {
            setAssignOpen(false)
            setAssignee("")
          }}
          title="Assign Quotations"
          description={`Assign ${selectedKeys.size} selected quotation${selectedKeys.size === 1 ? "" : "s"} to a user, or clear the current assignment.`}
        >
          <LinkSearchField
            value={assignee || undefined}
            onChange={(v) => setAssignee(v ?? "")}
            searchFn={(query) =>
              quotationService.searchAssignableUsers(query).then((users) => ({
                items: users.map((u) => ({ value: u.value, label: u.label, description: u.description })),
              }))
            }
            placeholder="Type to search users..."
            required
            className="w-full"
            clearIconMode="hover"
          />
          <ModalFooter>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
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

        <Modal
          open={tagsOpen}
          onClose={() => {
            setTagsOpen(false)
            setTagsInput("")
          }}
          title="Add Tags"
          description={`Add tags to ${selectedKeys.size} selected quotation${selectedKeys.size === 1 ? "" : "s"}. Separate tags with commas.`}
        >
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. Follow-up, Q3, Priority"
            className="w-full"
          />
          <ModalFooter>
            <Button variant="ghost" onClick={() => setTagsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAddTags} loading={actingToolbar}>
              Add Tags
            </Button>
          </ModalFooter>
        </Modal>

        {/* Confirmation Dialog */}
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
          confirmLabel={
            confirmAction?.type.includes("submit") ? "Submit"
            : confirmAction?.type.includes("cancel") ? "Cancel Quotation"
            : confirmAction?.type.includes("amend") ? "Amend"
            : "Delete"
          }
          cancelLabel="No, go back"
          variant={
            confirmAction?.type.includes("delete") || confirmAction?.type.includes("cancel")
              ? "danger"
              : "warning"
          }
          loading={acting}
          error={confirmError}
        />

        {/* Export Dialog */}
        <Modal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          title="Export Quotations"
          description={
            selectedKeys.size > 0
              ? `Export ${selectedKeys.size} selected quotation(s)`
              : "Export all quotations matching current filters"
          }
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
            {Object.entries(QUOTATION_EXPORT_FIELDS).map(([group, fields]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-body mb-1.5">{group}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {fields.map((field) => (
                    <label key={field} className="flex items-center gap-2 text-sm text-body cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(exportFields[group] ?? []).includes(field)}
                        onChange={() => toggleExportField(group, field)}
                        className="accent-primary-600"
                      />
                      <span className="capitalize">{field.replace(/_/g, " ")}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkExport} loading={actingToolbar}>
              <Download size={14} /> Export
            </Button>
          </ModalFooter>
        </Modal>

        {/* Print Dialog */}
        <Modal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          title="Print Quotations"
          description={`Generate a PDF preview for ${selectedKeys.size} selected quotation${selectedKeys.size === 1 ? "" : "s"}. A new tab opens with the PDF — download it from there (mirrors ERPNext).`}
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
            <option value="">Default (A4)</option>
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="A5">A5</option>
            <option value="B5">B5</option>
            <option value="Letter">Letter</option>
            <option value="Legal">Legal</option>
            <option value="Ledger">Ledger</option>
            <option value="Executive">Executive</option>
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
      </motion.div>
    </>
  )
}
