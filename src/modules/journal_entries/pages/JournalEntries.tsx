"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Download, AlertCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import {
  Button,
  Modal,
  ModalFooter,
  ConfirmationDialog,
  useMessageDialog,
  messageFromError,
} from "@/components/ui"
import { journalEntryService, type JournalEntryRow, type JournalEntryListResponse } from "@/services"
import { JOURNAL_ENTRY_EXPORT_FIELDS } from "../services"
import JournalEntryTable from "../components/JournalEntryTable"
import { rFilterToArgs, type RFilter } from "../components/JournalEntryFilters"

type StatusFilter = "All" | "Draft" | "Submitted" | "Cancelled"

const FILTERS: StatusFilter[] = ["All", "Draft", "Submitted", "Cancelled"]

const STATUS_PARAM: Record<Exclude<StatusFilter, "All">, "draft" | "submitted" | "cancelled"> = {
  Draft: "draft",
  Submitted: "submitted",
  Cancelled: "cancelled",
}

const STATUS_DOCSTATUS: Record<Exclude<StatusFilter, "All">, number> = {
  Draft: 0,
  Submitted: 1,
  Cancelled: 2,
}

type BulkAction = "bulk-submit" | "bulk-cancel" | "bulk-delete"
type SingleAction = "single-submit" | "single-cancel" | "single-delete"

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function JournalEntries() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showMessage } = useMessageDialog()
  const [data, setData] = useState<JournalEntryListResponse | null>(null)
  const [allItems, setAllItems] = useState<JournalEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [start, setStart] = useState(0)
  const [pageLength, setPageLength] = useState(20)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [actingToolbar, setActingToolbar] = useState(false)

  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<"CSV" | "Excel">("CSV")
  const [exportFields, setExportFields] = useState<Record<string, string[]>>(() =>
    JSON.parse(JSON.stringify(JOURNAL_ENTRY_EXPORT_FIELDS))
  )

  const [confirmAction, setConfirmAction] = useState<
    { type: BulkAction | SingleAction; target?: string } | null
  >(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

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
    return field || "posting_date"
  })
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    const order = searchParams.get("sort")?.split(" ")[1]
    return order === "asc" ? "asc" : "desc"
  })

  // The status pill is surfaced as a `status` chip (single source of truth
  // with the filter bar/URL); the service maps the label onto the JE
  // docstatus tuple itself.
  const statusChip = filters.find((f) => f.field === "status" && f.operator === "=")
  const activeFilter: StatusFilter = (statusChip?.value as StatusFilter) ?? "All"
  const filtersArgs = useMemo(
    () =>
      filters
        .filter((f) => !(f.field === "status" && f.operator === "="))
        .flatMap(rFilterToArgs),
    [filters]
  )
  const hasActiveFilters = filters.length > 0
  const statusParam: "draft" | "submitted" | "cancelled" | undefined =
    activeFilter === "All" ? undefined : STATUS_PARAM[activeFilter]

  // Persist filters/sort in the URL.
  useEffect(() => {
    const next: Record<string, string> = {}
    if (filters.length > 0) next.filters = JSON.stringify(filters)
    if (sortBy !== "posting_date" || sortOrder !== "desc") next.sort = `${sortBy} ${sortOrder}`
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

  const fetchData = useCallback(async (append = false) => {
    setLoading(true)
    setError("")
    try {
      const result = await journalEntryService.list({
        search: search || undefined,
        page: Math.floor((append ? start : 0) / pageLength) + 1,
        pageSize: pageLength,
        status: statusParam,
        filters: filtersArgs.length > 0 ? filtersArgs : undefined,
        sortBy,
        sortOrder,
      })
      setData(result)
      setAllItems((prev) => (append ? [...prev, ...result.items] : result.items))
      if (!append) setStart(pageLength)
      else setStart((s) => s + pageLength)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load journal entries.")
    } finally {
      setLoading(false)
    }
  }, [search, activeFilter, filtersArgs, sortBy, sortOrder, start, pageLength]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStart(0)
    setAllItems([])
    fetchData(false)
  }, [search, activeFilter, filtersArgs, sortBy, sortOrder, pageLength]) // eslint-disable-line react-hooks/exhaustive-deps

  // Status pills mutate the "Status = x" chip, keeping one source of truth.
  const handleFilterPill = (f: string) => {
    setFilters((prev) => {
      const rest = prev.filter((x) => !(x.field === "status" && x.operator === "="))
      if (f === "All") return rest
      return [...rest, { field: "status", label: "Status", operator: "=", value: f }]
    })
  }

  const handleLoadMore = () => {
    fetchData(true)
  }

  const handlePageLengthChange = (size: number) => {
    setStart(0)
    setAllItems([])
    setPageLength(size)
  }

  const selectedItems = allItems.filter((e) => selectedKeys.has(e.id))
  const hasDraftSelected = selectedItems.some((e) => e.status === "draft")
  const hasSubmittedSelected = selectedItems.some((e) => e.status === "submitted")
  const hasCancelledSelected = selectedItems.some((e) => e.status === "cancelled")

  const confirmInfo = (() => {
    if (!confirmAction) return { title: "", message: "" }
    const { type, target } = confirmAction
    const count = type.startsWith("bulk-") ? selectedKeys.size : 1
    const name = target ?? ""
    switch (type) {
      case "bulk-submit":
        return { title: `Submit ${count} entries`, message: `Permanently submit ${count} journal entr${count === 1 ? "y" : "ies"}? This action cannot be undone.` }
      case "bulk-cancel":
        return { title: `Cancel ${count} entries`, message: `Permanently cancel ${count} journal entr${count === 1 ? "y" : "ies"}? This action cannot be undone.` }
      case "bulk-delete":
        return { title: `Delete ${count} entries`, message: `Delete ${count} journal entr${count === 1 ? "y" : "ies"}? This action cannot be undone.` }
      case "single-submit":
        return { title: "Submit Entry", message: `Permanently submit ${name}? This action cannot be undone.` }
      case "single-cancel":
        return { title: "Cancel Entry", message: `Permanently cancel ${name}? This action cannot be undone.` }
      case "single-delete":
        return { title: "Delete Entry", message: `Delete ${name}? This action cannot be undone.` }
      default:
        return { title: "", message: "" }
    }
  })()

  const runBulk = async (op: BulkAction) => {
    const keys = Array.from(selectedKeys)
    let failed: string[] = []
    let enqueued = false
    if (op === "bulk-submit") {
      const res = await journalEntryService.bulkSubmit(keys)
      failed = res.failed
      enqueued = res.enqueued
    } else if (op === "bulk-cancel") {
      const res = await journalEntryService.bulkCancel(keys)
      failed = res.failed
      enqueued = res.enqueued
    } else {
      const res = await journalEntryService.bulkDelete(keys)
      failed = res.failed
    }
    const done = keys.length - failed.length
    if (done > 0) {
      setSelectedKeys(new Set(failed))
      const verb = op === "bulk-submit" ? "Submitted" : op === "bulk-cancel" ? "Cancelled" : "Deleted"
      showMessage(
        enqueued
          ? `${verb} ${done} journal entr${done === 1 ? "y" : "ies"} in background.`
          : `${verb} ${done} journal entr${done === 1 ? "y" : "ies"}.`,
      )
    }
    if (failed.length > 0) {
      throw new Error(
        `${failed.length} journal entr${failed.length === 1 ? "y" : "ies"} not processed: ${failed.join(", ")}`,
      )
    }
  }

  const handleConfirm = async () => {
    if (!confirmAction) return
    setActing(true)
    setConfirmError(null)
    try {
      const { type, target } = confirmAction
      if (type === "bulk-submit" || type === "bulk-cancel" || type === "bulk-delete") {
        await runBulk(type)
      } else if (type === "single-submit" && target) {
        await journalEntryService.submitDoc(target)
        showMessage(`Submitted ${target}.`)
      } else if (type === "single-cancel" && target) {
        await journalEntryService.cancelDoc(target)
        showMessage(`Cancelled ${target}.`)
      } else if (type === "single-delete" && target) {
        await journalEntryService.delete(target)
        showMessage(`Deleted ${target}.`)
      }
      setConfirmAction(null)
      fetchData(false)
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Action failed.")
    } finally {
      setActing(false)
    }
  }

  const toSearchResult =
    (doctype: string) =>
    async (query: string) => {
      const items = await journalEntryService.searchLink(doctype, query)
      return { items }
    }

  const exportScopeFilters = (): unknown[] | undefined => {
    if (selectedKeys.size > 0) return [["Journal Entry", "name", "in", Array.from(selectedKeys)]]
    if (filtersArgs.length > 0) return filtersArgs
    if (statusParam) return [["Journal Entry", "docstatus", "=", STATUS_DOCSTATUS[activeFilter as Exclude<StatusFilter, "All">]]]
    return undefined
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
    setExportFields(JSON.parse(JSON.stringify(JOURNAL_ENTRY_EXPORT_FIELDS)))
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
      const blob = await journalEntryService.exportRecords({
        fileType: exportFormat,
        fields: selectedGroups,
        filters: exportScopeFilters(),
      })
      downloadBlob(blob, `JournalEntries.${exportFormat === "CSV" ? "csv" : "xlsx"}`)
      setExportOpen(false)
      showMessage(`Exported ${selectedKeys.size > 0 ? selectedKeys.size : "filtered"} journal entries.`)
    } catch (err) {
      showMessage(messageFromError(err, "Export failed."))
    } finally {
      setActingToolbar(false)
    }
  }

  const tableData = data ? { ...data, items: allItems } : null

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Journal Entries</h1>
            <p className="text-sm text-muted mt-1">Record and manage accounting journal entries.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              <Download size={16} /> Export
            </Button>
            <Button onClick={() => navigate("/journal-entries/new")}><Plus size={16} /> New Entry</Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <JournalEntryTable
          data={tableData}
          loading={loading}
          filters={FILTERS}
          activeFilter={activeFilter}
          onFilterChange={handleFilterPill}
          filterChips={filters}
          onFilterChipsChange={setFilters}
          companySearch={toSearchResult("Company")}
          accountSearch={toSearchResult("Account")}
          sort={{ field: sortBy, order: sortOrder, onChange: handleSort }}
          search={search}
          onSearch={setSearch}
          paginationMode="loadMore"
          currentPageLength={pageLength}
          onPageLengthChange={handlePageLengthChange}
          onLoadMore={handleLoadMore}
          onRowClick={(entry) => navigate(`/journal-entries/${entry.id}`)}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          hasActiveFilters={hasActiveFilters}
          hasDraftSelected={hasDraftSelected}
          hasSubmittedSelected={hasSubmittedSelected}
          hasCancelledSelected={hasCancelledSelected}
          onSubmitSingle={(name) => setConfirmAction({ type: "single-submit", target: name })}
          onCancelSingle={(name) => setConfirmAction({ type: "single-cancel", target: name })}
          onDeleteSingle={(name) => setConfirmAction({ type: "single-delete", target: name })}
          onBulkSubmit={() => setConfirmAction({ type: "bulk-submit" })}
          onBulkCancel={() => setConfirmAction({ type: "bulk-cancel" })}
          onBulkDelete={() => setConfirmAction({ type: "bulk-delete" })}
        />

        <Modal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          title="Export Journal Entries"
          description={`Export ${selectedKeys.size > 0 ? `${selectedKeys.size} selected` : "all filtered"} journal entries.`}
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
            {Object.entries(JOURNAL_ENTRY_EXPORT_FIELDS).map(([group, fields]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-body mb-1.5">{group}</p>
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
            <Button variant="outline" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} loading={actingToolbar}><Download size={14} /> Export</Button>
          </ModalFooter>
        </Modal>

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
            : confirmAction?.type.includes("cancel") ? "Cancel Entry"
            : "Delete"
          }
          cancelLabel="No, go back"
          variant={confirmAction?.type.includes("delete") || confirmAction?.type.includes("cancel") ? "danger" : "warning"}
          loading={acting}
          error={confirmError}
        />
      </motion.div>
    </>
  )
}