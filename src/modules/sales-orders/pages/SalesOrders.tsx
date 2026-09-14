"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Download, UserRound } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Modal, ModalFooter, Input, ConfirmationDialog, BulkPrintDialog, type PrintSettings } from "@/components/ui"
import { useMessageDialog, messageFromError, LinkSearchField } from "@/components/ui"
import { salesOrderService, SALES_ORDER_EXPORT_FIELDS, type SalesOrder, type SalesOrderListResponse, type SalesOrderIndicatorLabel } from "@/services"
import SalesOrderTable from "../components/SalesOrderTable"
import { rFilterToArgs, type RFilter } from "../components/SalesOrderFilters"
import { openMultiPdfPrint } from "@/lib/multi-pdf-print"

type Filter = SalesOrderIndicatorLabel | "All"

const FILTERS: Filter[] = [
  "All",
  "Draft",
  "Overdue",
  "On Hold",
  "To Deliver and Bill",
  "To Deliver",
  "To Bill",
  "Completed",
  "Cancelled",
  "Closed",
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function SalesOrders() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showMessage } = useMessageDialog()
  const [data, setData] = useState<SalesOrderListResponse | null>(null)
  const [allItems, setAllItems] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
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
  const [start, setStart] = useState(0)
  const [pageLength, setPageLength] = useState(20)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [actingToolbar, setActingToolbar] = useState(false)

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    type: "bulk-submit" | "bulk-cancel" | "bulk-amend" | "bulk-delete" | "bulk-close"
      | "single-submit" | "single-cancel" | "single-delete" | "single-amend"
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
  const [exportFields, setExportFields] = useState<Record<string, string[]>>(JSON.parse(JSON.stringify(SALES_ORDER_EXPORT_FIELDS)))

  // Print dialog
  const [printOpen, setPrintOpen] = useState(false)

  const statusChip = filters.find((f) => f.field === "status" && f.operator === "=")
  const activeFilter: Filter = (statusChip?.value as Filter) ?? "All"
  const filtersArgs = useMemo(() => filters.flatMap(rFilterToArgs), [filters])
  const hasActiveFilters = filters.length > 0

  // Persist filters/sort in the URL like ERPNext's list view.
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

  const fetchData = useCallback(
    async (append = false) => {
      setLoading(true)
      setError("")
      try {
        const result = await salesOrderService.list({
          page: Math.floor((append ? start : 0) / pageLength) + 1,
          pageSize: pageLength,
          filters: filtersArgs,
          sortBy,
          sortOrder,
        })
        setData(result)
        setAllItems((prev) => (append ? [...prev, ...result.items] : result.items))
        if (!append) setStart(pageLength)
        else setStart((s) => s + pageLength)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load sales orders")
      } finally {
        setLoading(false)
      }
    },
    [start, pageLength, filtersArgs, sortBy, sortOrder]
  )

  useEffect(() => {
    setStart(0)
    fetchData(false)
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    filtersArgs,
    sortBy,
    sortOrder,
    pageLength,
  ])

  const handleLoadMore = () => {
    fetchData(true)
  }

  const handlePageLengthChange = (size: number) => {
    setPageLength(size)
  }

  // Status pills mutate the "Status = x" chip, keeping one source of truth.
  const handleFilterPill = (f: string) => {
    setFilters((prev) => {
      const rest = prev.filter((x) => !(x.field === "status" && x.operator === "="))
      if (f === "All") return rest
      return [...rest, { field: "status", label: "Status", operator: "=", value: f }]
    })
  }

  // ERPNext list parity: clicking a list value applies it as a filter on that
  // field, replacing any existing filter on the same field (like list_view.js's
  // filter_area.remove(...) followed by add(...)).
  const handleCellFilter = useCallback((chip: RFilter) => {
    setFilters((prev) => [...prev.filter((x) => x.field !== chip.field), chip])
  }, [])

  const handleSort = (field: string, order: "asc" | "desc") => {
    setSortBy(field)
    setSortOrder(order)
  }

  const selectedItems = useMemo(() => {
    return allItems.filter((so) => selectedKeys.has(so.name))
  }, [allItems, selectedKeys])

  const hasDraftSelected = useMemo(() => selectedItems.some((so) => so.docstatus === 0), [selectedItems])
  const hasSubmittedSelected = useMemo(() => selectedItems.some((so) => so.docstatus === 1), [selectedItems])
  const hasCancelledSelected = useMemo(() => selectedItems.some((so) => so.docstatus === 2), [selectedItems])
  const hasClosedSelected = useMemo(() => selectedItems.some((so) => so.docstatus === 1 && so.rawStatus === "Closed"), [selectedItems])

  // ── Confirmation dialog info ────────────────────────────────────────
  const confirmInfo = useMemo(() => {
    if (!confirmAction) return { title: "", message: "" }
    const { type, target } = confirmAction
    const count = type.startsWith("bulk-") ? selectedKeys.size : 1
    const name = target ?? ""
    switch (type) {
      case "bulk-submit":
        return { title: `Submit ${count} sales orders`, message: `Permanently submit ${count} sales order(s)? This action cannot be undone.` }
      case "bulk-cancel":
        return { title: `Cancel ${count} sales orders`, message: `Permanently cancel ${count} sales order(s)? This will reverse all GL entries.` }
      case "bulk-amend":
        return { title: `Amend ${count} sales orders`, message: `Create new draft copies of ${count} sales order(s)?` }
      case "bulk-delete":
        return { title: `Delete ${count} sales orders`, message: `Delete ${count} sales order(s)? This action cannot be undone. Submitted or amendment-linked orders are skipped and reported.` }
      case "bulk-close":
        return { title: `Close ${count} sales orders`, message: `Close ${count} sales order(s)? Remaining fulfillment will no longer be tracked.` }
      case "single-submit":
        return { title: "Submit Sales Order", message: `Permanently submit ${name}? This action cannot be undone.` }
      case "single-cancel":
        return { title: "Cancel Sales Order", message: `Permanently cancel ${name}? This will reverse all GL entries.` }
      case "single-delete":
        return { title: "Delete Sales Order", message: `Delete ${name}? This action cannot be undone.` }
      case "single-amend":
        return { title: "Amend Sales Order", message: `Create a new draft copy of ${name}?` }
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
        const { failed, enqueued, messages } = await salesOrderService.bulkSubmit(Array.from(selectedKeys))
        if (failed.length > 0) {
          const reason = messages.map((m) => m.message).join("\n")
          const detail = reason ? `\n${reason}` : ""
          throw new Error(`${failed.length} sales order${failed.length === 1 ? "" : "s"} not submitted: ${failed.join(", ")}${detail}`)
        }
        setSelectedKeys(new Set())
        showMessage(enqueued
          ? `Bulk submit queued for ${count} sales order${count === 1 ? "" : "s"} — they will be submitted in the background.`
          : `Submitted ${count} sales order${count === 1 ? "" : "s"}.`)
      } else if (type === "bulk-cancel") {
        const { failed, enqueued, messages } = await salesOrderService.bulkCancel(Array.from(selectedKeys))
        if (failed.length > 0) {
          const reason = messages.map((m) => m.message).join("\n")
          const detail = reason ? `\n${reason}` : ""
          throw new Error(`${failed.length} sales order${failed.length === 1 ? "" : "s"} not canceled: ${failed.join(", ")}${detail}`)
        }
        setSelectedKeys(new Set())
        showMessage(enqueued
          ? `Bulk cancel queued for ${count} sales order${count === 1 ? "" : "s"} — they will be cancelled in the background.`
          : `Canceled ${count} sales order${count === 1 ? "" : "s"}.`)
      } else if (type === "bulk-delete") {
        const { failed, deleted, messages } = await salesOrderService.bulkDelete(Array.from(selectedKeys))
        const reason = messages.map((m) => m.message).join("\n")
        const detail = reason ? `\n${reason}` : ""
        if (deleted.length > 0) {
          setSelectedKeys(new Set(failed))
          fetchData()
          showMessage(`Deleted ${deleted.length} sales order${deleted.length === 1 ? "" : "s"}.`)
        }
        if (failed.length > 0) {
          throw new Error(`${failed.length} sales order${failed.length === 1 ? "" : "s"} not deleted: ${failed.join(", ")}${detail}`)
        }
        if (deleted.length === 0) {
          setSelectedKeys(new Set())
          showMessage(`Deleted ${count} sales order${count === 1 ? "" : "s"}.`)
        }
      } else if (type === "bulk-close") {
        const closable = selectedItems
          .filter((so) => so.docstatus === 1 && so.rawStatus !== "Closed")
          .map((so) => so.name)
        await salesOrderService.closeOrUncloseSalesOrders(closable, "Closed")
        setSelectedKeys(new Set())
        showMessage(`Closed ${closable.length} sales order${closable.length === 1 ? "" : "s"}.`)
      } else if (type === "bulk-amend") {
        const names = Array.from(selectedKeys)
        for (const n of names) {
          const { doc } = await salesOrderService.getDoc(n)
          await salesOrderService.amend(doc)
        }
        setSelectedKeys(new Set())
        showMessage(`Amended ${names.length} sales order${names.length === 1 ? "" : "s"} as new drafts.`)
      } else if (type === "single-submit" && target) {
        await salesOrderService.submitDoc(target)
        showMessage(`Submitted ${target}.`)
      } else if (type === "single-cancel" && target) {
        await salesOrderService.cancelDoc(target)
        showMessage(`Canceled ${target}.`)
      } else if (type === "single-delete" && target) {
        await salesOrderService.delete(target)
        showMessage(`Deleted ${target}.`)
      } else if (type === "single-amend" && target) {
        const { doc } = await salesOrderService.getDoc(target)
        const amended = await salesOrderService.amend(doc)
        navigate(`/sales-orders/${amended.name}`)
        return
      }
      setConfirmAction(null)
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
    setExportFields(JSON.parse(JSON.stringify(SALES_ORDER_EXPORT_FIELDS)))
  }

  const buildExportFilters = (): unknown[] | undefined => {
    return filtersArgs.length > 0 ? filtersArgs : undefined
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
      const blob = await salesOrderService.exportRecords({
        fileType: exportFormat,
        recordMode: "by_filter",
        fields: Object.keys(fields).length > 0 ? fields : undefined,
        filters: exportScopeFilters(),
      })
      downloadBlob(blob, `Sales Orders.${exportFormat === "Excel" ? "xlsx" : "csv"}`)
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
      foregroundUrl: salesOrderService.buildMultiPdfUrl(printable, options),
      backgroundUrl: settings.background
        ? salesOrderService.buildMultiPdfUrl(printable, options, true)
        : undefined,
      onBlocked: () => showMessage("Pop-up blocked — please allow pop-ups for this site."),
      onBackgroundFallback: () =>
        showMessage("Background print isn't supported by this server — printing in the foreground."),
    })
  }

  // ── Bulk assign / tags ──────────────────────────────────────────────
  const handleBulkAssign = async (remove = false) => {
    const names = Array.from(selectedKeys)
    setAssignOpen(false)
    setActingToolbar(true)
    try {
      if (remove) {
        await salesOrderService.removeAssignment(names)
      } else if (!assignee.trim()) {
        throw new Error("Please enter an assignee.")
      } else {
        await salesOrderService.assignTo(names, assignee.trim())
      }
      showMessage(remove ? "Assignment cleared." : `Assigned ${names.length} sales order${names.length === 1 ? "" : "s"} to ${assignee.trim()}.`)
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
          await salesOrderService.addTagToDoc(name, label)
        }
      }
      showMessage(`Added ${labels.length} tag${labels.length === 1 ? "" : "s"} to ${names.length} sales order${names.length === 1 ? "" : "s"}.`)
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
            <h1 className="text-2xl font-bold text-heading">Sales Orders</h1>
            <p className="text-sm text-muted mt-1">Track customer orders and fulfillment.</p>
          </div>
          <Button variant="primary" onClick={() => navigate("/sales-orders/new")}>
            <Plus size={16} /> New
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-[14px] text-sm text-danger-700 whitespace-pre-line">
            {error}
          </div>
        )}

        <SalesOrderTable
          data={data ? { ...data, items: allItems } : data}
          loading={loading || actingToolbar}
          filters={FILTERS}
          activeFilter={activeFilter}
          onFilterChange={handleFilterPill}
          filterChips={filters}
          onFilterChipsChange={setFilters}
          customerSearch={(q) => salesOrderService.searchCustomers(q).then((items) => ({ items }))}
          companySearch={(q) => salesOrderService.searchCompanies(q).then((items) => ({ items }))}
          sort={{ field: sortBy, order: sortOrder, onChange: handleSort }}
          paginationMode="loadMore"
          currentPageLength={pageLength}
          onPageLengthChange={handlePageLengthChange}
          onLoadMore={handleLoadMore}
          onRowClick={(so) => navigate(`/sales-orders/${so.id}`)}
          onCellFilter={handleCellFilter}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          hasActiveFilters={hasActiveFilters}
          hasDraftSelected={hasDraftSelected}
          hasSubmittedSelected={hasSubmittedSelected}
          hasCancelledSelected={hasCancelledSelected}
          hasClosedSelected={hasClosedSelected}
          onSubmitSingle={(name) => setConfirmAction({ type: "single-submit", target: name })}
          onCancelSingle={(name) => setConfirmAction({ type: "single-cancel", target: name })}
          onDeleteSingle={(name) => setConfirmAction({ type: "single-delete", target: name })}
          onAmendSingle={(name) => setConfirmAction({ type: "single-amend", target: name })}
          onBulkSubmit={() => setConfirmAction({ type: "bulk-submit" })}
          onBulkCancel={() => setConfirmAction({ type: "bulk-cancel" })}
          onBulkAmend={() => setConfirmAction({ type: "bulk-amend" })}
          onBulkDelete={() => setConfirmAction({ type: "bulk-delete" })}
          onBulkClose={() => setConfirmAction({ type: "bulk-close" })}
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
          title="Assign Sales Orders"
          description={`Assign ${selectedKeys.size} selected sales order${selectedKeys.size === 1 ? "" : "s"} to a user, or clear the current assignment.`}
        >
          <LinkSearchField
            value={assignee || undefined}
            onChange={(v) => setAssignee(v ?? "")}
            searchFn={(query) =>
              salesOrderService.searchAssignableUsers(query).then((users) => ({
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
          description={`Add tags to ${selectedKeys.size} selected sales order${selectedKeys.size === 1 ? "" : "s"}. Separate tags with commas.`}
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
            : confirmAction?.type.includes("cancel") ? "Cancel Sales Order"
            : confirmAction?.type.includes("amend") ? "Amend"
            : confirmAction?.type.includes("close") ? "Close"
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
          title="Export Sales Orders"
          description={
            selectedKeys.size > 0
              ? `Export ${selectedKeys.size} selected sales order(s)`
              : "Export all sales orders matching current filters"
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
            {Object.entries(SALES_ORDER_EXPORT_FIELDS).map(([group, fields]) => (
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
          title="Print Sales Orders"
          count={selectedKeys.size}
          getPrintFormats={salesOrderService.getPrintFormats}
          getLetterHeads={salesOrderService.lookups.letterHeads}
          onPrint={handleBulkPrint}
        />
      </motion.div>
    </>
  )
}