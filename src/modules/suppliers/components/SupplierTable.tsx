"use client"

import { Truck, Users, AlertTriangle, Ban, Download, Trash2 } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge, Avatar, FilterPills, ListBulkActions } from "@/components/ui"
import { type Supplier, type SupplierListResponse, type SupplierStatus } from "@/services"
import { formatCurrency } from "@/lib/utils"
import SupplierFilters, { type RFilter, type SupplierSort } from "./SupplierFilters"

const statusMeta: Record<SupplierStatus, { label: string; variant: "success" | "warning" | "default" }> = {
  active: { label: "Active", variant: "success" },
  on_hold: { label: "On Hold", variant: "warning" },
  disabled: { label: "Disabled", variant: "default" },
}

const SUPPLIER_STATUS_FILTERS = ["All", "On Hold", "Disabled"]

function buildColumns(
  onCellFilter?: (chip: RFilter) => void,
): Column<Supplier>[] {
  return [
    {
      key: "supplier_name",
      header: "Supplier",
      width: "w-[24%]",
      title: (s) => `Supplier: ${s.supplier_name} · ${s.name}`,
      render: (s) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={s.supplier_name} size="sm" className="shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-body truncate">{s.supplier_name}</p>
            <span
              className="text-xs text-muted truncate cursor-pointer hover:text-primary-700 hover:underline block"
              onClick={(e) => {
                e.stopPropagation()
                onCellFilter?.({ field: "supplier_name", label: "Supplier", operator: "=", value: s.supplier_name })
              }}
              title={`Filter by ${s.supplier_name}`}
            >
              {s.name}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "supplier_group",
      header: "Group",
      width: "w-[15%]",
      title: (s) => (s.supplier_group ? `Group: ${s.supplier_group}` : "Group: —"),
      render: (s) => (
        <span
          className="text-sm text-muted truncate cursor-pointer hover:text-primary-700 hover:underline inline-block"
          onClick={(e) => {
            e.stopPropagation()
            onCellFilter?.({ field: "supplier_group", label: "Group", operator: "=", value: s.supplier_group ?? "" })
          }}
        >
          {s.supplier_group || "—"}
        </span>
      ),
    },
    {
      key: "supplier_type",
      header: "Type",
      width: "w-[12%]",
      title: (s) => (s.supplier_type ? `Type: ${s.supplier_type}` : "Type: —"),
      render: (s) => <span className="text-sm text-muted">{s.supplier_type || "—"}</span>,
    },
    {
      key: "country",
      header: "Country",
      width: "w-[14%]",
      title: (s) => (s.country ? `Country: ${s.country}` : "Country: —"),
      render: (s) => (
        <span
          className="text-sm text-muted truncate cursor-pointer hover:text-primary-700 hover:underline inline-block"
          onClick={(e) => {
            e.stopPropagation()
            onCellFilter?.({ field: "country", label: "Country", operator: "=", value: s.country ?? "" })
          }}
        >
          {s.country || "—"}
        </span>
      ),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      width: "w-[13%]",
      title: (s) => `Outstanding: ${formatCurrency(s.outstanding)}`,
      render: (s) => (
        <span className="font-semibold tabular-nums text-heading">
          {formatCurrency(s.outstanding)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[12%]",
      title: (s) => `Status: ${statusMeta[s.status].label}`,
      render: (s) => (
        <Badge variant={statusMeta[s.status].variant}>{statusMeta[s.status].label}</Badge>
      ),
    },
  ]
}

interface SupplierTableProps {
  data: SupplierListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  filters?: string[]
  activeFilter?: string
  onFilterChange?: (filter: string) => void
  filterChips?: RFilter[]
  onFilterChipsChange?: (filterChips: RFilter[]) => void
  onCellFilter?: (chip: RFilter) => void
  supplierGroupSearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  companySearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  currencySearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  sort?: SupplierSort
  hasActiveFilters: boolean
  onRowClick?: (supplier: Supplier) => void
  selectable?: boolean
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
  toolbarActions?: React.ReactNode
  pageLength: number
  onPageLengthChange: (size: number) => void
  onLoadMore: () => void
}

export default function SupplierTable({
  data,
  loading,
  search,
  onSearch,
  filters,
  activeFilter,
  onFilterChange,
  filterChips,
  onFilterChipsChange,
  onCellFilter,
  supplierGroupSearch,
  companySearch,
  currencySearch,
  sort,
  hasActiveFilters,
  onRowClick,
  selectable,
  selectedKeys,
  onSelectionChange,
  toolbarActions,
  pageLength,
  onPageLengthChange,
  onLoadMore,
}: SupplierTableProps) {
  const allItems = data?.items ?? []
  const outstanding = allItems.reduce((s, i) => s + (i.outstanding ?? 0), 0)
  const activeCount = allItems.filter((s) => s.status === "active").length
  const onHoldCount = allItems.filter((s) => s.status === "on_hold").length
  const disabledCount = allItems.filter((s) => s.status === "disabled").length

  const bulkToolbar = toolbarActions ?? (
    <ListBulkActions
      count={selectedKeys?.size ?? 0}
      noun="suppliers"
      fallback={null}
      items={[
        { label: "Delete", icon: <Trash2 size={14} />, danger: true, onClick: () => {} },
        { label: "Export", icon: <Download size={14} />, separatorBefore: true, onClick: () => {} },
      ]}
    />
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-[10px] bg-primary-50 text-primary-600 shrink-0">
            <Truck size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">Total Suppliers</p>
            <p className="text-2xl font-bold text-heading tracking-tight mt-0.5 tabular-nums">{data?.total ?? 0}</p>
            <p className="text-xs text-muted mt-0.5 truncate">{formatCurrency(outstanding)} outstanding</p>
          </div>
        </div>
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-[10px] bg-success-50 text-success-600 shrink-0">
            <Users size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">Active</p>
            <p className="text-2xl font-bold text-heading tracking-tight mt-0.5 tabular-nums">{activeCount}</p>
            <p className="text-xs text-muted mt-0.5 truncate">Current vendors</p>
          </div>
        </div>
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-[10px] bg-warning-50 text-warning-600 shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">On Hold</p>
            <p className="text-2xl font-bold text-heading tracking-tight mt-0.5 tabular-nums">{onHoldCount}</p>
            <p className="text-xs text-muted mt-0.5 truncate">Payments stalled</p>
          </div>
        </div>
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-[10px] bg-gray-100 text-muted shrink-0">
            <Ban size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">Disabled</p>
            <p className="text-2xl font-bold text-heading tracking-tight mt-0.5 tabular-nums">{disabledCount}</p>
            <p className="text-xs text-muted mt-0.5 truncate">Inactive vendors</p>
          </div>
        </div>
      </div>

      {/* Status pills (ERPNext Supplier quick filters) */}
      <FilterPills
        options={filters ?? SUPPLIER_STATUS_FILTERS}
        value={activeFilter ?? "All"}
        onChange={(f) => onFilterChange?.(f)}
      />

      {/* ERPNext-style filter bar + FilterGroup */}
      <SupplierFilters
        filters={filterChips ?? []}
        onFiltersChange={(next) => onFilterChipsChange?.(next)}
        supplierGroupSearch={supplierGroupSearch}
        companySearch={companySearch}
        currencySearch={currencySearch}
        sort={sort}
      />

      <DataTable
        columns={buildColumns(onCellFilter)}
        data={allItems}
        keyExtractor={(s) => s.name}
        searchable searchPlaceholder="Search suppliers..."
        searchQuery={search}
        onSearch={onSearch}
        loading={loading}
        total={data?.total}
        pageSize={pageLength}
        onRowClick={onRowClick}
        selectable={selectable}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        toolbarActions={bulkToolbar}
        paginationMode="loadMore"
        currentPageLength={pageLength}
        onPageLengthChange={onPageLengthChange}
        onLoadMore={onLoadMore}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-4">
            <Truck size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No suppliers found</p>
            <p className="text-xs text-muted">
              {hasActiveFilters || search
                ? "No suppliers match the current filter."
                : "Add a supplier to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}