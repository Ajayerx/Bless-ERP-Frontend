"use client"

import {
  Receipt,
  CheckCircle2,
  Clock,
  FileText,
  XCircle,
  Send,
  RotateCcw,
  Trash2,
  Download,
  CircleAlert,
  Wallet,
  Info,
} from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge, FilterPills, ListBulkActions } from "@/components/ui"
import {
  getPurchaseInvoiceIndicator,
  type PurchaseInvoice,
  type PurchaseInvoiceListResponse,
  type PurchaseInvoiceIndicator,
  type PurchaseInvoiceIndicatorLabel,
} from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"
import BillFilters, { type RFilter, type BillSort } from "./BillFilters"

const indicatorIcon: Record<PurchaseInvoiceIndicatorLabel, React.ReactNode> = {
  Draft: <Clock size={14} />,
  Cancelled: <XCircle size={14} />,
  Submitted: <Info size={14} />,
  Paid: <CheckCircle2 size={14} />,
  "Partly Paid": <CircleAlert size={14} />,
  Unpaid: <FileText size={14} />,
  Overdue: <CircleAlert size={14} />,
}

function indicatorForLight(inv: PurchaseInvoice): PurchaseInvoiceIndicator {
  return getPurchaseInvoiceIndicator({
    docstatus: inv.docstatus,
    outstanding_amount: inv.outstandingAmount,
    paid_amount: inv.paidAmount,
    due_date: inv.dueDate,
  })
}

function buildColumns(
  actions: {
    onSubmitSingle: (name: string) => void
    onCancelSingle: (name: string) => void
    onDeleteSingle: (name: string) => void
  },
  onCellFilter?: (chip: RFilter) => void,
): Column<PurchaseInvoice>[] {
  return [
    {
      key: "name",
      header: "Bill No.",
      width: "w-[24%]",
      render: (inv) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
            <Receipt size={16} />
          </div>
          <div className="min-w-0">
            <p className="max-w-full truncate font-semibold text-heading">{inv.number}</p>
            <p className="text-xs text-muted truncate">{inv.supplierName}</p>
          </div>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      width: "w-[16%]",
      render: (inv) => (
        <div className="min-w-0">
          <span
            className="text-sm text-body truncate cursor-pointer hover:text-primary-700 hover:underline inline-block max-w-full"
            onClick={(e) => {
              e.stopPropagation()
              onCellFilter?.({ field: "supplier", label: "Supplier", operator: "=", value: inv.supplierId })
            }}
            title={`Filter by ${inv.supplierName}`}
          >
            {inv.supplierName || "—"}
          </span>
          <p className="text-xs text-muted truncate">{inv.supplierId}</p>
        </div>
      ),
    },
    {
      key: "postingDate",
      header: "Posting Date",
      width: "w-[12%]",
      render: (inv) => <span className="text-sm text-muted">{formatDate(inv.postingDate)}</span>,
    },
    {
      key: "dueDate",
      header: "Due Date",
      width: "w-[12%]",
      render: (inv) => (
        <span className={inv.indicator === "Overdue" ? "text-sm text-danger-600 font-semibold" : "text-sm text-muted"}>
          {formatDate(inv.dueDate)}
        </span>
      ),
    },
    {
      key: "grandTotal",
      header: "Amount",
      align: "right",
      width: "w-[12%]",
      render: (inv) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(inv.grandTotal)}</span>,
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      width: "w-[12%]",
      render: (inv) => (
        <span className="font-semibold tabular-nums text-heading">{formatCurrency(inv.outstandingAmount)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[14%]",
      render: (inv) => {
        const indicator = indicatorForLight(inv)
        return (
          <Badge variant={indicator.variant} className="gap-1">
            {indicatorIcon[indicator.label]}
            {indicator.label}
          </Badge>
        )
      },
    },
    {
      key: "actions",
      header: "",
      width: "w-[8%]",
      noTruncate: true,
      render: (inv) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {inv.docstatus === 0 && (
            <>
              <button
                onClick={() => actions.onSubmitSingle(inv.name)}
                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="Submit"
              >
                <Send size={13} />
              </button>
              <button
                onClick={() => actions.onDeleteSingle(inv.name)}
                className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {inv.docstatus === 1 && (
            <button
              onClick={() => actions.onCancelSingle(inv.name)}
              className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              title="Cancel"
            >
              <RotateCcw size={13} />
            </button>
          )}
          {inv.docstatus === 2 && (
            <button
              onClick={() => actions.onDeleteSingle(inv.name)}
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

interface BillTableProps {
  data: PurchaseInvoiceListResponse | null
  loading: boolean
  filters: readonly string[]
  activeFilter: string
  onFilterChange: (filter: string) => void
  filterChips?: RFilter[]
  onFilterChipsChange?: (filterChips: RFilter[]) => void
  onCellFilter?: (chip: RFilter) => void
  supplierSearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  companySearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  currencySearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  sort?: BillSort
  onRowClick?: (inv: PurchaseInvoice) => void
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

export default function BillTable({
  data,
  loading,
  filters,
  activeFilter,
  onFilterChange,
  filterChips,
  onFilterChipsChange,
  onCellFilter,
  supplierSearch,
  companySearch,
  currencySearch,
  sort,
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
}: BillTableProps) {
  const items = data?.items ?? []
  const totalAmount = items.reduce((s, inv) => s + (inv.grandTotal ?? 0), 0)
  const outstandingAmount = items.filter((inv) => inv.docstatus === 1).reduce((s, inv) => s + (inv.outstandingAmount ?? 0), 0)
  const overdueCount = items.filter((inv) => inv.indicator === "Overdue").length
  const paidCount = items.filter((inv) => inv.indicator === "Paid").length

  const bulkToolbar = (
    <ListBulkActions
      count={selectedKeys?.size ?? 0}
      noun="bills"
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
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-[10px] bg-warning-50 text-warning-600 shrink-0">
                <Receipt size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Bills</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(totalAmount)}</p>
                <p className="text-xs text-muted mt-0.5">{data?.total ?? 0} bills</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-[10px] bg-info-50 text-info-600 shrink-0">
                <Wallet size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Outstanding</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(outstandingAmount)}</p>
                <p className="text-xs text-muted mt-0.5">Awaiting payment</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-[10px] bg-danger-50 text-danger-600 shrink-0">
                <CircleAlert size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Overdue</p>
                <p className="text-2xl font-bold text-heading mt-1">{overdueCount}</p>
                <p className="text-xs text-muted mt-0.5">Needs attention</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-[10px] bg-success-50 text-success-600 shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Paid</p>
                <p className="text-2xl font-bold text-heading mt-1">{paidCount}</p>
                <p className="text-xs text-muted mt-0.5">Fully paid bills</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <FilterPills options={filters} value={activeFilter} onChange={onFilterChange} />

      {/* ERPNext-style filter bar + FilterGroup */}
      <BillFilters
        filters={filterChips ?? []}
        onFiltersChange={(next) => onFilterChipsChange?.(next)}
        supplierSearch={supplierSearch}
        companySearch={companySearch}
        currencySearch={currencySearch}
        sort={sort}
      />

      <DataTable
        columns={buildColumns({ onSubmitSingle, onCancelSingle, onDeleteSingle }, onCellFilter)}
        data={data?.items ?? []}
        keyExtractor={(inv) => inv.name}
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
            <Receipt size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No bills found</p>
            <p className="text-xs text-muted">
              {hasActiveFilters
                ? "No bills match the current filter."
                : "Create your first purchase invoice to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}