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
import {
  purchaseOrderService,
  PURCHASE_ORDER_EXPORT_FIELDS,
  type PurchaseOrder,
  type PurchaseOrderListResponse,
} from "@/services"
import PurchaseTable from "../components/PurchaseTable"
import { rFilterToArgs, type RFilter } from "../components/PurchaseOrderFilters"

type StatusFilter = "All" | "Draft" | "To Receive" | "To Bill" | "Completed" | "On Hold" | "Cancelled" | "Closed"

const FILTERS: StatusFilter[] = ["All", "Draft", "To Receive", "To Bill", "Completed", "On Hold", "Cancelled", "Closed"]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Purchases() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showMessage } = useMessageDialog()
  const [data, setData] = useState<PurchaseOrderListResponse | null>(null)
  const [allItems, setAllItems] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [start, setStart] = useState(0)
  const [pageLength, setPageLength] = useState(20)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [actingToolbar, setActingToolbar] = useState(false)

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    type: "bulk-submit" | "bulk-cancel" | "bulk-delete" | "single-submit" | "single-cancel" | "single-delete"
    target?: string
  } | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  // Export dialog
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<"CSV" | "Excel">("CSV")
  const [exportFields, setExportFields] = useState<Record<string, string[]>>(() =>
    JSON.parse(JSON.stringify(PURCHASE_ORDER_EXPORT_FIELDS))
  )

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

  // The status pill is surfaced as a `status` chip (single source of truth
  // with the filter bar/URL); the service maps the label onto
  // PURCHASE_ORDER_FILTER_TUPLES itself.
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

  const fetchData = useCallback(async (append = false) => {
    setLoading(true)
    setError("")
    try {
      const result = await purchaseOrderService.list({
        page: Math.floor((append ? start : 0) / pageLength) + 1,
        pageSize: pageLength,
        status: activeFilter === "All" ? undefined : activeFilter,
        filters: filtersArgs.length > 0 ? filtersArgs : undefined,
        sortBy,
        sortOrder,
      })
      setData(result)
      setAllItems((prev) => (append ? [...prev, ...result.items] : result.items))
      if (!append) setStart(pageLength)
      else setStart((s) => s + pageLength)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load purchase orders.")
    } finally {
      setLoading(false)
    }
  }, [activeFilter, filtersArgs, sortBy, sortOrder, start, pageLength]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStart(0)
    setAllItems([])
    fetchData(false)
  }, [activeFilter, filtersArgs, sortBy, sortOrder, pageLength]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setStart(0)
    setAllItems([])
    setPageLength(size)
  }

  const selectedItems = allItems.filter((po) => selectedKeys.has(po.name))
  const hasDraftSelected = selectedItems.some((po) => po.docstatus === 0)
  const hasSubmittedSelected = selectedItems.some((po) => po.docstatus === 1)
  const hasCancelledSelected = selectedItems.some((po) => po.docstatus === 2)

  const confirmInfo = (() => {
    if (!confirmAction) return { title: "", message: "" }
    const { type, target } = confirmAction
    const count = type.startsWith("bulk-") ? selectedKeys.size : 1
    const name = target ?? ""
    switch (type) {
      case "bulk-submit":
        return { title: `Submit ${count} purchase orders`, message: `Permanently submit ${count} purchase order(s)? This action cannot be undone.` }
      case "bulk-cancel":
        return { title: `Cancel ${count} purchase orders`, message: `Permanently cancel ${count} purchase order(s)? This action cannot be undone.` }
      case "bulk-delete":
        return { title: `Delete ${count} purchase orders`, message: `Delete ${count} purchase order(s)? This action cannot be undone. Submitted orders are skipped and reported.` }
      case "single-submit":
        return { title: "Submit Purchase Order", message: `Permanently submit ${name}? This action cannot be undone.` }
      case "single-cancel":
        return { title: "Cancel Purchase Order", message: `Permanently cancel ${name}? This action cannot be undone.` }
      case "single-delete":
        return { title: "Delete Purchase Order", message: `Delete ${name}? This action cannot be undone.` }
      default:
        return { title: "", message: "" }
    }
  })()

  const handleConfirm = async () => {
    if (!confirmAction) return
    setActing(true)
    setConfirmError(null)
    try {
      const { type, target } = confirmAction
      const count = selectedKeys.size
      if (type === "bulk-submit") {
        const { failed, enqueued, messages } = await purchaseOrderService.bulkSubmit(Array.from(selectedKeys))
        if (failed.length > 0) {
          const reason = messages.map((m) => m.message).join("\n")
          throw new Error(`${failed.length} purchase order${failed.length === 1 ? "" : "s"} not submitted: ${failed.join(", ")}${reason ? `\n${reason}` : ""}`)
        }
        setSelectedKeys(new Set())
        showMessage(enqueued
          ? `Bulk submit queued for ${count} purchase order${count === 1 ? "" : "s"}.`
          : `Submitted ${count} purchase order${count === 1 ? "" : "s"}.`)
      } else if (type === "bulk-cancel") {
        const { failed, enqueued, messages } = await purchaseOrderService.bulkCancel(Array.from(selectedKeys))
        if (failed.length > 0) {
          const reason = messages.map((m) => m.message).join("\n")
          throw new Error(`${failed.length} purchase order${failed.length === 1 ? "" : "s"} not cancelled: ${failed.join(", ")}${reason ? `\n${reason}` : ""}`)
        }
        setSelectedKeys(new Set())
        showMessage(enqueued
          ? `Bulk cancel queued for ${count} purchase order${count === 1 ? "" : "s"}.`
          : `Cancelled ${count} purchase order${count === 1 ? "" : "s"}.`)
      } else if (type === "bulk-delete") {
        const { failed, deleted, messages } = await purchaseOrderService.bulkDelete(Array.from(selectedKeys))
        const reason = messages.map((m) => m.message).join("\n")
        if (deleted.length > 0) {
          setSelectedKeys(new Set(failed))
          showMessage(`Deleted ${deleted.length} purchase order${deleted.length === 1 ? "" : "s"}.`)
        }
        if (failed.length > 0) {
          throw new Error(`${failed.length} purchase order${failed.length === 1 ? "" : "s"} not deleted: ${failed.join(", ")}${reason ? `\n${reason}` : ""}`)
        }
        if (deleted.length === 0) {
          setSelectedKeys(new Set())
          showMessage(`Deleted ${count} purchase order${count === 1 ? "" : "s"}.`)
        }
      } else if (type === "single-submit" && target) {
        await purchaseOrderService.submitDoc(target)
        showMessage(`Submitted ${target}.`)
      } else if (type === "single-cancel" && target) {
        await purchaseOrderService.cancelDoc(target)
        showMessage(`Cancelled ${target}.`)
      } else if (type === "single-delete" && target) {
        await purchaseOrderService.delete(target)
        showMessage(`Deleted ${target}.`)
      }
      setConfirmAction(null)
      fetchData()
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Action failed.")
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
    setExportFields(JSON.parse(JSON.stringify(PURCHASE_ORDER_EXPORT_FIELDS)))
  }

  const exportScopeFilters = (): unknown[] | undefined => {
    const names = Array.from(selectedKeys)
    if (names.length > 0) return [["Purchase Order", "name", "in", names]]
    return filtersArgs.length > 0 ? filtersArgs : undefined
  }

  const handleExport = async () => {
    setActingToolbar(true)
    try {
      const activeGroups = Object.fromEntries(
        Object.entries(exportFields).filter(([, fields]) => fields.length > 0)
      )
      if (Object.keys(activeGroups).length === 0) {
        throw new Error("Select at least one column to export.")
      }
      const blob = await purchaseOrderService.exportRecords({
        fileType: exportFormat,
        recordMode: "by_filter",
        fields: activeGroups,
        filters: exportScopeFilters(),
      })
      downloadBlob(blob, `Purchase Orders.${exportFormat === "CSV" ? "csv" : "xlsx"}`)
      setExportOpen(false)
      showMessage(selectedKeys.size > 0 ? `Exported ${selectedKeys.size} purchase orders.` : "Export complete.")
    } catch (err) {
      showMessage(messageFromError(err, "Export failed."))
    } finally {
      setActingToolbar(false)
    }
  }

  const toSearchResult =
    (doctype: string) => async (query: string) => {
      const items = await purchaseOrderService.searchLink(doctype, query)
      return { items }
    }

  const tableData = data ? { ...data, items: allItems } : null

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
            <h1 className="text-2xl font-bold text-heading">Purchase Orders</h1>
            <p className="text-sm text-muted mt-1">
              Manage purchase orders and supplier deliveries.
            </p>
          </div>
          <Button onClick={() => navigate("/purchases/new")}>
            <Plus size={16} />
            New Purchase Order
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <PurchaseTable
          data={tableData}
          loading={loading || actingToolbar}
          filters={FILTERS}
          activeFilter={activeFilter}
          onFilterChange={handleFilterPill}
          filterChips={filters}
          onFilterChipsChange={setFilters}
          onCellFilter={handleCellFilter}
          supplierSearch={toSearchResult("Supplier")}
          companySearch={toSearchResult("Company")}
          currencySearch={toSearchResult("Currency")}
          sort={{ field: sortBy, order: sortOrder, onChange: handleSort }}
          paginationMode="loadMore"
          currentPageLength={pageLength}
          onPageLengthChange={handlePageLengthChange}
          onLoadMore={handleLoadMore}
          onRowClick={(po) => navigate(`/purchases/${po.id}`)}
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
          onBulkExport={() => setExportOpen(true)}
        />

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
            : confirmAction?.type.includes("cancel") ? "Cancel Purchase Order"
            : "Delete"
          }
          cancelLabel="No, go back"
          variant={confirmAction?.type.includes("delete") || confirmAction?.type.includes("cancel") ? "danger" : "warning"}
          loading={acting}
          error={confirmError}
        />

        <Modal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          title="Export Purchase Orders"
          description={
            selectedKeys.size > 0
              ? `Export ${selectedKeys.size} selected purchase order(s)`
              : "Export purchase orders matching the current filter"
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
            {Object.entries(PURCHASE_ORDER_EXPORT_FIELDS).map(([group, fields]) => (
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