"use client"

import { Users } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge, Avatar } from "@/components/ui"
import { cn } from "@/lib/utils"
import { type Customer, type CustomerListResponse } from "@/services"
import CustomerFilters, { type RFilter, type CustomerSort } from "./CustomerFilters"

const CUSTOMER_STATUS_FILTERS: string[] = ["All", "Active", "Disabled", "Frozen"]

function statusOf(c: Customer): "Active" | "Disabled" | "Frozen" {
  if (c.is_frozen) return "Frozen"
  if (c.disabled) return "Disabled"
  return "Active"
}

const statusVariant: Record<string, "default" | "success" | "warning" | "danger"> = {
  Active: "success",
  Disabled: "warning",
  Frozen: "danger",
}

interface CustomerTableProps {
  data: CustomerListResponse | null
  loading: boolean
  onRowClick?: (customer: Customer) => void
  /** Status pill tabs (All/Active/Disabled/Frozen). */
  filters?: string[]
  activeFilter?: string
  onFilterChange?: (filter: string) => void
  filterChips?: RFilter[]
  onFilterChipsChange?: (filterChips: RFilter[]) => void
  onCellFilter?: (chip: RFilter) => void
  groupSearch?: (query: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  territorySearch?: (query: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  sort?: CustomerSort
  hasActiveFilters: boolean
  selectable?: boolean
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
  toolbarActions?: React.ReactNode
  paginationMode?: "pages" | "loadMore"
  currentPageLength?: number
  onPageLengthChange?: (size: number) => void
  onLoadMore?: () => void
}

export default function CustomerTable({
  data,
  loading,
  onRowClick,
  filters,
  activeFilter,
  onFilterChange,
  filterChips,
  onFilterChipsChange,
  onCellFilter,
  groupSearch,
  territorySearch,
  sort,
  hasActiveFilters,
  selectable,
  selectedKeys,
  onSelectionChange,
  toolbarActions,
  paginationMode = "loadMore",
  currentPageLength,
  onPageLengthChange,
  onLoadMore,
}: CustomerTableProps) {
  const customerColumns: Column<Customer>[] = [
    {
      key: "customer_name",
      header: "Customer",
      width: "w-[24%]",
      title: (c) => `Customer: ${c.customer_name} · ${c.name}`,
      render: (c) => (
        <div className="flex items-center gap-3 min-w-0">
          {c.image ? (
            <img
              src={c.image.startsWith("http") ? c.image : `/api/method/frappe.utils.file_manager.get_file?name=${encodeURIComponent(c.image)}`}
              alt=""
              className="w-8 h-8 rounded-lg object-cover shrink-0"
            />
          ) : (
            <Avatar name={c.customer_name} size="sm" className="shrink-0" />
          )}
          <div className="min-w-0">
            <span
              className="text-sm text-body cursor-pointer hover:text-primary-700 hover:underline block truncate"
              onClick={(e) => {
                e.stopPropagation()
                onCellFilter?.({ field: "customer_name", label: "Name", operator: "=", value: c.customer_name })
              }}
              title={`Filter by ${c.customer_name}`}
            >
              {c.customer_name}
            </span>
            {/* ID behaves like ERPNext's detached ID column: clicking it filters */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCellFilter?.({ field: "name", label: "ID", operator: "=", value: c.name })
              }}
              title="Filter by this ID (click row to open)"
              className={cn(
                "text-xs truncate max-w-full text-left rounded px-1 -mx-1 transition-colors cursor-pointer",
                (filterChips ?? []).some((f) => f.field === "name" && f.value === c.name)
                  ? "bg-primary-50 text-primary-700 font-medium"
                  : "text-muted hover:text-primary-700 hover:bg-gray-100"
              )}
            >
              {c.name}
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "email_id",
      header: "Contact",
      width: "w-[24%]",
      title: (c) => `Contact: ${[c.email_id, c.mobile_no].filter(Boolean).join(" · ")}`,
      render: (c) => (
        <div className="space-y-0.5 min-w-0">
          <p className="text-xs text-muted truncate">{c.email_id || "—"}</p>
          <p className="text-xs text-muted truncate">{c.mobile_no || "—"}</p>
        </div>
      ),
    },
    {
      key: "customer_group",
      header: "Group",
      width: "w-[12%]",
      title: (c) => (c.customer_group ? `Group: ${c.customer_group}` : "Group: —"),
      render: (c) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (c.customer_group) onCellFilter?.({ field: "customer_group", label: "Group", operator: "=", value: c.customer_group })
          }}
          title={c.customer_group ? `Filter by ${c.customer_group}` : undefined}
          disabled={!c.customer_group}
          className={cn(
            "text-sm rounded px-1 -mx-1 transition-colors",
            (filterChips ?? []).some((f) => f.field === "customer_group" && f.value === c.customer_group)
              ? "text-primary-700 font-semibold"
              : "text-muted hover:text-primary-700 hover:bg-gray-100",
            !c.customer_group && "cursor-default text-muted/50"
          )}
        >
          {c.customer_group || "—"}
        </button>
      ),
    },
    {
      key: "territory",
      header: "Territory",
      width: "w-[13%]",
      title: (c) => (c.territory ? `Territory: ${c.territory}` : "Territory: —"),
      render: (c) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (c.territory) onCellFilter?.({ field: "territory", label: "Territory", operator: "=", value: c.territory })
          }}
          title={c.territory ? `Filter by ${c.territory}` : undefined}
          disabled={!c.territory}
          className={cn(
            "text-sm rounded px-1 -mx-1 transition-colors",
            (filterChips ?? []).some((f) => f.field === "territory" && f.value === c.territory)
              ? "text-primary-700 font-semibold"
              : "text-muted hover:text-primary-700 hover:bg-gray-100",
            !c.territory && "cursor-default text-muted/50"
          )}
        >
          {c.territory || "—"}
        </button>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[13%]",
      title: (c) => `Status: ${statusOf(c)}`,
      render: (c) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCellFilter?.({ field: "status", label: "Status", operator: "=", value: statusOf(c) })
          }}
          title={`Filter by ${statusOf(c)}`}
          className="rounded-lg -m-1 p-1 transition-colors hover:bg-gray-100 cursor-pointer"
        >
          <Badge variant={statusVariant[statusOf(c)] ?? "default"}>{statusOf(c)}</Badge>
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {data && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Users size={16} />
          <span>
            <strong className="text-heading">{data.total}</strong> total
            customers
          </span>
        </div>
      )}

      {/* Status pill tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(filters ?? CUSTOMER_STATUS_FILTERS).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFilterChange?.(f)}
            className={cn(
              "h-8 px-3 rounded-full text-xs font-semibold transition-colors",
              (activeFilter ?? "All") === f
                ? "bg-primary-100 text-primary-700"
                : "text-muted hover:bg-gray-100 hover:text-body"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ERPNext-style filter bar + FilterGroup */}
      <CustomerFilters
        filters={filterChips ?? []}
        onFiltersChange={(next) => onFilterChipsChange?.(next)}
        groupSearch={groupSearch}
        territorySearch={territorySearch}
        sort={sort}
      />

      <DataTable
        columns={customerColumns}
        data={data?.items ?? []}
        keyExtractor={(c) => c.name}
        loading={loading}
        total={data?.total}
        pageSize={currentPageLength ?? 20}
        onRowClick={onRowClick}
        selectable={selectable}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        toolbarActions={toolbarActions}
        paginationMode={paginationMode}
        currentPageLength={currentPageLength}
        onPageLengthChange={onPageLengthChange}
        onLoadMore={onLoadMore}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-4">
            <Users size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No customers found</p>
            <p className="text-xs text-muted">
              {hasActiveFilters
                ? "No customers match the current filters."
                : "Add a customer to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}