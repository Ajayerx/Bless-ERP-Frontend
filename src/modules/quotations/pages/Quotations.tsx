"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Download, UserRound } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Modal, ModalFooter, Input, ConfirmationDialog, BulkPrintDialog, type PrintSettings } from "@/components/ui"
import { useMessageDialog, messageFromError, LinkSearchField } from "@/components/ui"
import { quotationService, QUOTATION_EXPORT_FIELDS, type Quotation, type QuotationListResponse } from "@/services"
import QuotationTable from "../components/QuotationTable"
import { rFilterToArgs, type RFilter } from "../components/QuotationFilters"
import { openMultiPdfPrint } from "@/lib/multi-pdf-print"

type StatusFilter = "All" | "Draft" | "Open" | "Partially Ordered" | "Ordered" | "Lost" | "Cancelled" | "Expired"

const STATUS_FILTERS: StatusFilter[] = [
  "All",
  "Draft",
  "Open",
  "Partially Ordered",
  "Ordered",
  "Lost",
  "Cancelled",
  "Expired",
]

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
  const [searchParams, setSearchParams] = useSearchParams()
  const { showMessage } = useMessageDialog()
  const [data, setData] = useState<QuotationListResponse | null>(null)
  const [allItems, setAllItems] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [start, setStart] = useState(0)
  const [pageLength, setPageLength] = useState(20)
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

  // ── Unified filter state (single source of truth) ──────────────────
  const [filters, setFilters] = useState<RFilter[]>(() => {
    try {
      const raw = searchParams.get("filters")
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as RFilter[]) : []
    } catch {
      return []
    }
  })
  const [sortBy, setSortBy] = useState(() => {
    const field = searchParams.get("sort")?.split(" ")[0]
    return field || "transaction_date"
  })
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    const order = searchParams.get("sort")?.split(" ")[1]
    return order === "asc" ? "asc" : "desc"
  })

  const statusChip = filters.find((f) => f.field === "status" && f.operator === "=")
  const activeFilter: StatusFilter = (statusChip?.value as StatusFilter) ?? "All"
  const filtersArgs = useMemo(() => filters.flatMap(rFilterToArgs), [filters])
  const hasActiveFilters = filters.length > 0

  // Persist filters/sort in the URL.
  useEffect(() => {
    const next: Record<string, string> = {}
    if (filters.length > 0) next.filters = JSON.stringify(filters)
    if (sortBy !== "transaction_date" || sortOrder !== "desc") next.sort = `${sortBy} ${sortOrder}`
    const current = Object.fromEntries(searchParams.entries())
    const same =
      Object.keys(next).length === Object.keys(current).length &&
      Object.entries(next).every(([k, v]) => current[k] === v)
    if (same) return
    setSearchParams(next, { replace: true })
  }, [filters, sortBy, sortOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (field: string, order: "asc" | "desc") => {
    setSortBy(field)
    setSortOrder(order)
  }

  const fetchData = useCallback(
    async (append = false) => {
      setLoading(true)
      setError("")
      try {
        const result = await quotationService.list({
          page: Math.floor((append ? start : 0) / pageLength) + 1,
          pageSize: pageLength,
          filters: filtersArgs.length > 0 ? filtersArgs : undefined,
          sortBy: sortBy || undefined,
          sortOrder,
        })
        setData(result)
        setAllItems((prev) => (append ? [...prev, ...result.items] : result.items))
        if (!append) setStart(pageLength)
        else setStart((s) => s + pageLength)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load quotations")
      } finally {
        setLoading(false)
      }
    },
    [start, pageLength, filtersArgs, sortBy, sortOrder]
  )

  useEffect(() => {
    setStart(0)
    fetchData(false)
  }, [filtersArgs, sortBy, sortOrder, pageLength]) // eslint-disable-line react-hooks/exhaustive-deps

  // Status pills mutate the "Status = x" chip, keeping one source of truth.
  const handleFilterPill = (f: string) => {
    setFilters((prev) => {
      const rest = prev.filter((x) => !(x.field === "status" && x.operator === "="))
      if (f === "All") return rest
      return [...rest, { field: "status", label: "Status", operator: "=", value: f }]
    })
  }

  // ERPNext list parity: clicking a list value applies it as a filter.
  const handleCellFilter = useCallback((chip: RFilter) => {
    setFilters((prev) => [...prev.filter((x) => x.field !== chip.field), chip])
  }, [])

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

  const exportScopeFilters = (): unknown[] | undefined => {
    if (selectedKeys.size > 0) return [["Quotation", "name", "in", Array.from(selectedKeys)]]
    return filtersArgs.length > 0 ? filtersArgs : undefined
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
  const handleBulkPrint = async (settings: PrintSettings) => {
    const printable = Array.from(selectedKeys)
    if (printable.length === 0) return
    const options = {
      printFormat: settings.printFormat,
      letterhead: settings.noLetterhead ? undefined : settings.letterhead,
      pageSize: settings.pageSize || undefined,
    }
    await openMultiPdfPrint({
      foregroundUrl: quotationService.buildMultiPdfUrl(printable, options),
      backgroundUrl: settings.background
        ? quotationService.buildMultiPdfUrl(printable, options, true)
        : undefined,
      onBlocked: () => showMessage("Pop-up blocked — please allow pop-ups for this site."),
      onBackgroundFallback: () =>
        showMessage("Background print isn't supported by this server — printing in the foreground."),
    })
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
          data={data ? { ...data, items: allItems } : null}
          loading={loading || bulkLoading}
          page={Math.floor(start / pageLength) + 1}
          onPageChange={() => {}}
          filters={STATUS_FILTERS}
          activeFilter={activeFilter}
          onFilterChange={handleFilterPill}
          filterChips={filters}
          onFilterChipsChange={setFilters}
          onRowClick={(quotation) => navigate(`/quotations/${quotation.name}`)}
          onCellFilter={handleCellFilter}
          partySearch={(quotationTo, q) => quotationService.searchParties(quotationTo, q)}
          companySearch={(q) => quotationService.searchCompanies(q)}
          sort={{ field: sortBy, order: sortOrder, onChange: handleSort }}
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
          onBulkPrint={() => setPrintOpen(true)}
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
        <BulkPrintDialog
          open={printOpen}
          onOpenChange={setPrintOpen}
          title="Print Quotations"
          count={selectedKeys.size}
          getPrintFormats={quotationService.getPrintFormats}
          getLetterHeads={quotationService.lookups.letterHeads}
          onPrint={handleBulkPrint}
        />
      </motion.div>
    </>
  )
}
