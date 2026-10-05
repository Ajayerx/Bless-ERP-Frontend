"use client"
import { Send, RotateCcw, Trash2, Wallet } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge, FilterPills, ListBulkActions } from "@/components/ui"
import { type JournalEntryRow, type JournalEntryListResponse, type JournalEntryStatus } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"
import JournalEntryFilters, { type RFilter, type JournalEntrySort } from "./JournalEntryFilters"

const statusVariant: Record<JournalEntryStatus, "success" | "warning" | "danger"> = {
  submitted: "success",
  draft: "warning",
  cancelled: "danger",
}

const statusLabel: Record<JournalEntryStatus, string> = {
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
): Column<JournalEntryRow>[] {
  return [
    {
      key: "number",
      header: "Number",
      render: (j) => (
        <div>
          <p className="font-semibold text-heading">{j.number}</p>
          <p className="text-xs text-muted">{j.posting_date ? formatDate(j.posting_date) : ""}</p>
        </div>
      ),
    },
    {
      key: "title",
      header: "Title",
      render: (j) => (
        <div>
          <p className="font-medium text-body line-clamp-1">{j.title || "—"}</p>
          <p className="text-xs text-muted line-clamp-1">{j.voucher_type || ""}</p>
        </div>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      render: (j) => (
        <span className="inline-block text-xs bg-gray-100 text-muted px-2 py-1 rounded-[6px] truncate max-w-full">
          {j.reference || "—"}
        </span>
      ),
    },
    {
      key: "total_debit",
      header: "Total Debit",
      className: "text-right",
      render: (j) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(j.total_debit)}</span>,
    },
    {
      key: "total_credit",
      header: "Total Credit",
      className: "text-right",
      render: (j) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(j.total_credit)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (j) => <Badge variant={statusVariant[j.status]}>{statusLabel[j.status]}</Badge>,
    },
    {
      key: "actions",
      header: "",
      noTruncate: true,
      render: (j) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {j.status === "draft" && (
            <>
              <button
                onClick={() => actions.onSubmitSingle(j.number)}
                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="Submit"
              >
                <Send size={13} />
              </button>
              <button
                onClick={() => actions.onDeleteSingle(j.number)}
                className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {j.status === "submitted" && (
            <button
              onClick={() => actions.onCancelSingle(j.number)}
              className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              title="Cancel"
            >
              <RotateCcw size={13} />
            </button>
          )}
          {j.status === "cancelled" && (
            <button
              onClick={() => actions.onDeleteSingle(j.number)}
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

interface JournalEntryTableProps {
  data: JournalEntryListResponse | null
  loading: boolean
  filters: readonly string[]
  activeFilter: string
  onFilterChange: (filter: string) => void
  filterChips?: RFilter[]
  onFilterChipsChange?: (filterChips: RFilter[]) => void
  companySearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  accountSearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  sort?: JournalEntrySort
  search: string
  onSearch: (q: string) => void
  onRowClick?: (entry: JournalEntryRow) => void
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
}

export default function JournalEntryTable({
  data,
  loading,
  filters,
  activeFilter,
  onFilterChange,
  filterChips,
  onFilterChipsChange,
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
}: JournalEntryTableProps) {
  const totalDebit = data?.items?.reduce((s, j) => s + j.total_debit, 0) ?? 0
  const totalCredit = data?.items?.reduce((s, j) => s + j.total_credit, 0) ?? 0
  const submittedCount = data?.items?.filter((j) => j.status === "submitted").length ?? 0
  const draftCount = data?.items?.filter((j) => j.status === "draft").length ?? 0
  const cancelledCount = data?.items?.filter((j) => j.status === "cancelled").length ?? 0

  const bulkToolbar = (
    <ListBulkActions
      count={selectedKeys?.size ?? 0}
      noun="journal entries"
      fallback={null}
      items={[
        { label: "Submit", icon: <Send size={14} />, show: hasDraftSelected, onClick: onBulkSubmit },
        { label: "Cancel", icon: <RotateCcw size={14} />, show: hasSubmittedSelected, danger: true, onClick: onBulkCancel },
        { label: "Delete", icon: <Trash2 size={14} />, show: hasDraftSelected || hasCancelledSelected, danger: true, onClick: onBulkDelete },
      ]}
    />
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Debit</p>
            <p className="text-2xl font-bold text-heading mt-1.5 tabular-nums">{formatCurrency(totalDebit)}</p>
            <p className="text-xs text-muted mt-0.5">{data?.total ?? 0} journal entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Credit</p>
            <p className="text-2xl font-bold text-success-600 mt-1.5 tabular-nums">{formatCurrency(totalCredit)}</p>
            <p className="text-xs text-muted mt-0.5">{submittedCount} submitted</p>
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
      <JournalEntryFilters
        filters={filterChips ?? []}
        onFiltersChange={(next) => onFilterChipsChange?.(next)}
        companySearch={companySearch}
        accountSearch={accountSearch}
        sort={sort}
      />

      <DataTable
        columns={buildColumns({ onSubmitSingle, onCancelSingle, onDeleteSingle })}
        data={data?.items ?? []}
        keyExtractor={(j) => j.id}
        searchable searchPlaceholder="Search journal entries..."
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
            <p className="font-semibold text-body">No journal entries found</p>
            <p className="text-xs text-muted">
              {hasActiveFilters
                ? "No journal entries match the current filter."
                : "Record your first journal entry to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}