"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Download, Trash2, AlertCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import {
  Button,
  Modal,
  ModalFooter,
  ListBulkActions,
  BulkDeleteModal,
  useMessageDialog,
  messageFromError,
  type BulkDeleteItem,
} from "@/components/ui"
import { bankAccountService } from "@/services"
import type { BankAccount, BankAccountListResponse } from "@/services"
import { BANK_ACCOUNT_EXPORT_FIELDS } from "../services"
import BankAccountTable from "../components/BankAccountTable"
import { rFilterToArgs, type RFilter } from "../components/BankAccountFilters"

type StatusFilter = "All" | "Enabled" | "Disabled"

const STATUS_FILTERS: StatusFilter[] = ["All", "Enabled", "Disabled"]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BankAccounts() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showMessage } = useMessageDialog()
  const [data, setData] = useState<BankAccountListResponse | null>(null)
  const [allItems, setAllItems] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [start, setStart] = useState(0)
  const [pageLength, setPageLength] = useState(20)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [deleteItems, setDeleteItems] = useState<BulkDeleteItem[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [actingToolbar, setActingToolbar] = useState(false)

  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<"CSV" | "Excel">("CSV")
  const [exportFields, setExportFields] = useState<Record<string, string[]>>(() =>
    JSON.parse(JSON.stringify(BANK_ACCOUNT_EXPORT_FIELDS))
  )

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
    return field || "account_name"
  })
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    const order = searchParams.get("sort")?.split(" ")[1]
    return order === "desc" ? "desc" : "asc"
  })

  const statusChip = filters.find((f) => f.field === "status" && f.operator === "=")
  const activeFilter: StatusFilter = (statusChip?.value as StatusFilter) ?? "All"
  const filtersArgs = useMemo(
    () =>
      filters
        .filter((f) => !(f.field === "status" && f.operator === "="))
        .flatMap(rFilterToArgs)
        .map((arr) => arr.slice(1) as unknown[]),
    [filters]
  )
  const hasActiveFilters = filters.length > 0

  const statusParam = activeFilter === "Disabled" ? "disabled" : activeFilter === "Enabled" ? "enabled" : undefined

  useEffect(() => {
    const next: Record<string, string> = {}
    if (filters.length > 0) next.filters = JSON.stringify(filters)
    if (sortBy !== "account_name" || sortOrder !== "asc") next.sort = `${sortBy} ${sortOrder}`
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
      const result = await bankAccountService.list({
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
      setError(e instanceof Error ? e.message : "Failed to load bank accounts.")
    } finally {
      setLoading(false)
    }
  }, [search, statusParam, filtersArgs, sortBy, sortOrder, start, pageLength]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStart(0)
    fetchData(false)
  }, [search, statusParam, filtersArgs, sortBy, sortOrder, pageLength]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterPill = (f: string) => {
    setFilters((prev) => {
      const rest = prev.filter((x) => !(x.field === "status" && x.operator === "="))
      if (f === "All") return rest
      return [...rest, { field: "status", label: "Status", operator: "=", value: f }]
    })
  }

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

  const handleBulkDelete = () => {
    if (!data || selectedKeys.size === 0) return
    const items: BulkDeleteItem[] = allItems
      .filter((a) => selectedKeys.has(a.name))
      .map((a) => ({ name: a.name, label: a.account_name }))
    setDeleteItems(items)
    setShowDeleteModal(true)
  }

  const handleDeleteComplete = () => {
    setSelectedKeys(new Set())
    setDeleteItems([])
    setStart(0)
    setAllItems([])
    fetchData(false)
  }

  const exportScopeFilters = (): unknown[] | undefined => {
    if (selectedKeys.size > 0) return [["Bank Account", "name", "in", Array.from(selectedKeys)]]
    if (filtersArgs.length > 0) return filtersArgs.map((f) => ["Bank Account", ...f])
    if (statusParam === "disabled") return [["Bank Account", "disabled", "=", 1]]
    if (statusParam === "enabled") return [["Bank Account", "disabled", "=", 0]]
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
    setExportFields(JSON.parse(JSON.stringify(BANK_ACCOUNT_EXPORT_FIELDS)))
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
      const blob = await bankAccountService.exportRecords({
        fileType: exportFormat,
        recordMode: "by_filter",
        fields: selectedGroups,
        filters: exportScopeFilters(),
      })
      downloadBlob(blob, `BankAccounts.${exportFormat === "CSV" ? "csv" : "xlsx"}`)
      setExportOpen(false)
      showMessage(`Exported ${selectedKeys.size > 0 ? selectedKeys.size : "filtered"} bank accounts.`)
    } catch (err) {
      showMessage(messageFromError(err, "Export failed."))
    } finally {
      setActingToolbar(false)
    }
  }

  const toSearchResult =
    (doctype: string) => async (query: string) => {
      const items = await bankAccountService.searchLink(doctype, query)
      return { items }
    }

  const tableData = data ? { ...data, items: allItems } : null

  return (
    <>
      <Topbar />
      <BulkDeleteModal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteItems([]) }}
        onComplete={handleDeleteComplete}
        items={deleteItems}
        onDelete={(name) => bankAccountService.delete(name)}
        doctypeLabel="Bank Account"
      />

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Bank Accounts"
        description={`Export ${selectedKeys.size > 0 ? `${selectedKeys.size} selected` : "all filtered"} bank accounts.`}
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
          {Object.entries(BANK_ACCOUNT_EXPORT_FIELDS).map(([group, fields]) => (
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
          <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
          <Button onClick={handleExport} loading={actingToolbar}>
            <Download size={14} /> Export
          </Button>
        </ModalFooter>
      </Modal>

      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Bank Accounts</h1>
            <p className="text-sm text-muted mt-1">
              Manage company and party bank accounts.
            </p>
          </div>
          <Button onClick={() => navigate("/bank-accounts/new")}>
            <Plus size={16} />
            Add Account
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <BankAccountTable
          data={tableData}
          loading={loading}
          search={search}
          onSearch={(q) => { setSearch(q); setStart(0) }}
          filters={STATUS_FILTERS}
          activeFilter={activeFilter}
          onFilterChange={handleFilterPill}
          filterChips={filters}
          onFilterChipsChange={setFilters}
          onCellFilter={handleCellFilter}
          bankSearch={toSearchResult("Bank")}
          companySearch={toSearchResult("Company")}
          partySearch={toSearchResult("Customer")}
          sort={{ field: sortBy, order: sortOrder, onChange: handleSort }}
          hasActiveFilters={hasActiveFilters}
          onRowClick={(account) => navigate(`/bank-accounts/${encodeURIComponent(account.name)}`)}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          pageLength={pageLength}
          onPageLengthChange={handlePageLengthChange}
          onLoadMore={handleLoadMore}
          toolbarActions={
            <ListBulkActions
              count={selectedKeys.size}
              noun="bank accounts"
              fallback={
                <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
                  <Download size={13} /> Export
                </Button>
              }
              items={[
                {
                  label: "Delete",
                  icon: <Trash2 size={14} />,
                  danger: true,
                  onClick: handleBulkDelete,
                },
                {
                  label: "Export",
                  icon: <Download size={14} />,
                  separatorBefore: true,
                  onClick: () => setExportOpen(true),
                },
              ]}
            />
          }
        />
      </motion.div>
    </>
  )
}