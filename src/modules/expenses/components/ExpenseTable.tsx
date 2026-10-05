"use client"

import { Wallet, Send, RotateCcw, Trash2, Download } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge, FilterPills, ListBulkActions } from "@/components/ui"
import { type Expense, type ExpenseListResponse } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"
import ExpenseFilters, { type RFilter, type ExpenseSort } from "./ExpenseFilters"

const statusVariant: Record<Expense["status"], "success" | "warning" | "danger"> = {
  submitted: "success",
  draft: "warning",
  cancelled: "danger",
}

const statusLabel: Record<Expense["status"], string> = {
  submitted: "Submitted",
  draft: "Draft",
  cancelled: "Cancelled",
}

function buildColumns(
  actions: {
    onSubmitSingle: (name: string) => void
    onCancelSingle: (name: string) => void
    onDeleteSingle: (name: string) => void
  },
  onCellFilter?: (chip: RFilter) => void,
): Column<Expense>[] {
  return [
    {
      key: "name",
      header: "JE Number",
      render: (e) => (
        <div>
          <p className="font-semibold text-heading">{e.name}</p>
          <p className="text-xs text-muted">{e.company}</p>
        </div>
      ),
    },
    {
      key: "postingDate",
      header: "Posting Date",
      render: (e) => <span className="text-sm text-muted">{formatDate(e.postingDate)}</span>,
    },
    {
      key: "expenseAccount",
      header: "Expense Account",
      render: (e) => (
        <span
          className="inline-block text-xs bg-gray-100 text-muted px-2 py-1 rounded-[6px] cursor-pointer hover:text-primary-700 hover:bg-primary-50"
          onClick={(ev) => {
            ev.stopPropagation()
            if (e.expenseAccount) {
              onCellFilter?.({ field: "account", label: "Expense Account", operator: "=", value: e.expenseAccount })
            }
          }}
          title={e.expenseAccount ? `Filter by ${e.expenseAccount}` : undefined}
        >
          {e.expenseAccount || "—"}
        </span>
      ),
    },
    {
      key: "remark",
      header: "Description",
      render: (e) => (
        <div>
          <p className="font-medium text-body line-clamp-1">{e.remark || "—"}</p>
          {e.supplier && <p className="text-xs text-muted">{e.supplier}</p>}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount (dr)",
      className: "text-right",
      render: (e) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(e.amount)}</span>,
    },
    {
      key: "paidFrom",
      header: "Paid From (cr)",
      render: (e) => (
        <span
          className="text-sm text-muted truncate inline-block max-w-full cursor-pointer hover:text-primary-700 hover:underline"
          onClick={(ev) => {
            ev.stopPropagation()
            if (e.paidFrom) {
              onCellFilter?.({ field: "account", label: "Expense Account", operator: "=", value: e.paidFrom })
            }
          }}
          title={e.paidFrom ? `Filter by ${e.paidFrom}` : undefined}
        >
          {e.paidFrom || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <Badge variant={statusVariant[e.status]}>{statusLabel[e.status]}</Badge>,
    },
    {
      key: "actions",
      header: "",
      noTruncate: true,
      render: (e) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {e.docstatus === 0 && (
            <>
              <button
                onClick={() => actions.onSubmitSingle(e.name)}
                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="Submit"
              >
                <Send size={13} />
              </button>
              <button
                onClick={() => actions.onDeleteSingle(e.name)}
                className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {e.docstatus === 1 && (
            <button
              onClick={() => actions.onCancelSingle(e.name)}
              className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              title="Cancel"
            >
              <RotateCcw size={13} />
            </button>
          )}
          {e.docstatus === 2 && (
            <button
              onClick={() => actions.onDeleteSingle(e.name)}
              className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ]
}

interface ExpenseTableProps {
  data: ExpenseListResponse | null
  loading: boolean
  filters: readonly string[]
  activeFilter: string
  onFilterChange: (filter: string) => void
  filterChips?: RFilter[]
  onFilterChipsChange?: (filterChips: RFilter[]) => void
  onCellFilter?: (chip: RFilter) => void
  companySearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  accountSearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  sort?: ExpenseSort
  search: string
  onSearch: (q: string) => void
  onRowClick?: (expense: Expense) => void
  paginationMode?: "pages" | "loadMore"
  currentPageLength?: number
  onPageLengthChange?: (size: number) => void
  onLoadMore?: () => void
  selectable?: boolean
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
  hasActiveFilters?: boolean
  hasDraftSelected: boolean
  hasSubmittedSelected: boolean
  hasCancelledSelected: boolean
  onSubmitSingle: (name: string) => void
  onCancelSingle: (name: string) => void
  onDeleteSingle: (name: string) => void
  onBulkSubmit: () => void
  onBulkCancel: () => void
  onBulkDelete: () => void
  onBulkExport: () => void
}

export default function ExpenseTable({
  data,
  loading,
  filters,
  activeFilter,
  onFilterChange,
  filterChips,
  onFilterChipsChange,
  onCellFilter,
  companySearch,
  accountSearch,
  sort,
  search,
  onSearch,
  onRowClick,
  paginationMode,
  currentPageLength,
  onPageLengthChange,
  onLoadMore,
  selectable,
  selectedKeys,
  onSelectionChange,
  hasActiveFilters,
  hasDraftSelected,
  hasSubmittedSelected,
  hasCancelledSelected,
  onSubmitSingle,
  onCancelSingle,
  onDeleteSingle,
  onBulkSubmit,
  onBulkCancel,
  onBulkDelete,
  onBulkExport,
}: ExpenseTableProps) {
  const totalAmount = data?.items?.reduce((s, e) => s + e.amount, 0) ?? 0
  const submittedAmount = data?.items?.filter((e) => e.status === "submitted")?.reduce((s, e) => s + e.amount, 0) ?? 0
  const draftCount = data?.items?.filter((e) => e.status === "draft").length ?? 0
  const cancelledCount = data?.items?.filter((e) => e.status === "cancelled").length ?? 0

  const bulkToolbar = (
    <ListBulkActions
      count={selectedKeys?.size ?? 0}
      noun="expenses"
      fallback={null}
      items={[
        { label: "Submit", icon: <Send size={14} />, show: hasDraftSelected, onClick: onBulkSubmit },
        { label: "Cancel", icon: <RotateCcw size={14} />, show: hasSubmittedSelected, danger: true, onClick: onBulkCancel },
        { label: "Delete", icon: <Trash2 size={14} />, show: hasDraftSelected || hasCancelledSelected, danger: true, onClick: onBulkDelete },
        { label: "Export", icon: <Download size={14} />, separatorBefore: true, onClick: onBulkExport },
      ]}
    />
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Expenses</p>
            <p className="text-2xl font-bold text-heading mt-1.5 tabular-nums">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-muted mt-0.5">{data?.total ?? 0} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Submitted</p>
            <p className="text-2xl font-bold text-success-600 mt-1.5 tabular-nums">{formatCurrency(submittedAmount)}</p>
            <p className="text-xs text-muted mt-0.5">Posted to the general ledger</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Draft</p>
            <p className="text-2xl font-bold text-heading mt-1.5">{draftCount}</p>
            <p className="text-xs text-muted mt-0.5">Not yet posted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Cancelled</p>
            <p className="text-2xl font-bold text-heading mt-1.5">{cancelledCount}</p>
            <p className="text-xs text-muted mt-0.5">Voided entries</p>
          </CardContent>
        </Card>
      </div>

      <FilterPills options={filters} value={activeFilter} onChange={onFilterChange} />

      {/* ERPNext-style filter bar + FilterGroup */}
      <ExpenseFilters
        filters={filterChips ?? []}
        onFiltersChange={(next) => onFilterChipsChange?.(next)}
        companySearch={companySearch}
        accountSearch={accountSearch}
        sort={sort}
      />

      <DataTable
        columns={buildColumns({ onSubmitSingle, onCancelSingle, onDeleteSingle }, onCellFilter)}
        data={data?.items ?? []}
        keyExtractor={(e) => e.id}
        searchable searchPlaceholder="Search expenses..."
        searchQuery={search}
        onSearch={(q) => onSearch(q)}
        loading={loading}
        total={data?.total}
        pageSize={currentPageLength ?? 10}
        onRowClick={onRowClick}
        toolbarActions={bulkToolbar}
        selectable={selectable}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        paginationMode={paginationMode}
        currentPageLength={currentPageLength}
        onPageLengthChange={onPageLengthChange}
        onLoadMore={onLoadMore}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-4">
            <Wallet size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No expenses found</p>
            <p className="text-xs text-muted">
              {hasActiveFilters
                ? "No expenses match the current filter."
                : "Record your first expense to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}