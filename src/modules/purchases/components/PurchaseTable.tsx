"use client"

import {
  ShoppingCart,
  CheckCircle2,
  Clock,
  FileText,
  XCircle,
  Send,
  RotateCcw,
  Trash2,
  Download,
  PauseCircle,
  Package,
  Lock,
  CircleAlert,
  Info,
} from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge, FilterPills, ListBulkActions } from "@/components/ui"
import {
  getPurchaseOrderIndicator,
  type PurchaseOrder,
  type PurchaseOrderListResponse,
  type PurchaseOrderIndicator,
  type PurchaseOrderIndicatorLabel,
} from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"
import PurchaseOrderFilters, { type RFilter, type PurchaseOrderSort } from "./PurchaseOrderFilters"

const indicatorIcon: Record<PurchaseOrderIndicatorLabel, React.ReactNode> = {
  Draft: <Clock size={14} />,
  Cancelled: <XCircle size={14} />,
  Submitted: <Info size={14} />,
  "On Hold": <PauseCircle size={14} />,
  Closed: <Lock size={14} />,
  Completed: <CheckCircle2 size={14} />,
  "To Receive": <Package size={14} />,
  "To Receive and Bill": <CircleAlert size={14} />,
  "To Bill": <FileText size={14} />,
}

function indicatorForLight(po: PurchaseOrder): PurchaseOrderIndicator {
  return getPurchaseOrderIndicator({
    docstatus: po.docstatus,
    status: po.rawStatus,
    per_received: po.perReceived,
    per_billed: po.perBilled,
  })
}

function buildColumns(
  actions: {
    onSubmitSingle: (name: string) => void
    onCancelSingle: (name: string) => void
    onDeleteSingle: (name: string) => void
  },
  onCellFilter?: (chip: RFilter) => void,
): Column<PurchaseOrder>[] {
  return [
    {
      key: "name",
      header: "PO Number",
      width: "w-[30%]",
      render: (po) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
            <ShoppingCart size={16} />
          </div>
          <div className="min-w-0">
            <p className="max-w-full truncate font-semibold text-heading">{po.number}</p>
            <p className="text-xs text-muted truncate">{po.supplierName}</p>
          </div>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      width: "w-[16%]",
      render: (po) => (
        <div className="min-w-0">
          <span
            className="text-sm text-body truncate cursor-pointer hover:text-primary-700 hover:underline inline-block max-w-full"
            onClick={(e) => {
              e.stopPropagation()
              onCellFilter?.({ field: "supplier", label: "Supplier", operator: "=", value: po.supplierId })
            }}
            title={`Filter by ${po.supplierName}`}
          >
            {po.supplierName || "—"}
          </span>
          <p className="text-xs text-muted truncate">{po.supplierId}</p>
        </div>
      ),
    },
    {
      key: "total",
      header: "Amount",
      align: "right",
      width: "w-[14%]",
      render: (po) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(po.total)}</span>,
    },
    {
      key: "itemCount",
      header: "Items",
      align: "right",
      width: "w-[10%]",
      render: (po) => <span className="text-sm text-muted tabular-nums">{po.items?.length ?? 0}</span>,
    },
    {
      key: "issueDate",
      header: "Order Date",
      width: "w-[12%]",
      render: (po) => <span className="text-sm text-muted">{formatDate(po.issueDate)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "w-[18%]",
      render: (po) => {
        const indicator = indicatorForLight(po)
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
      width: "w-[10%]",
      noTruncate: true,
      render: (po) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {po.docstatus === 0 && (
            <>
              <button
                onClick={() => actions.onSubmitSingle(po.name)}
                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="Submit"
              >
                <Send size={13} />
              </button>
              <button
                onClick={() => actions.onDeleteSingle(po.name)}
                className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {po.docstatus === 1 && (
            <button
              onClick={() => actions.onCancelSingle(po.name)}
              className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              title="Cancel"
            >
              <RotateCcw size={13} />
            </button>
          )}
          {po.docstatus === 2 && (
            <button
              onClick={() => actions.onDeleteSingle(po.name)}
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

interface PurchaseTableProps {
  data: PurchaseOrderListResponse | null
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
  sort?: PurchaseOrderSort
  onRowClick?: (po: PurchaseOrder) => void
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

export default function PurchaseTable({
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
}: PurchaseTableProps) {
  const totalAmount = (data?.items ?? []).reduce((s, po) => s + (po.total ?? 0), 0)
  const receivedCount = (data?.items ?? []).filter((po) => po.accumulationStatus === "received").length
  const pendingCount = (data?.items ?? []).filter((po) => po.accumulationStatus === "pending" || po.accumulationStatus === "partial").length
  const cancelledCount = (data?.items ?? []).filter((po) => po.accumulationStatus === "cancelled").length

  const bulkToolbar = (
    <ListBulkActions
      count={selectedKeys?.size ?? 0}
      noun="purchase orders"
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
                <ShoppingCart size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Orders</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(totalAmount)}</p>
                <p className="text-xs text-muted mt-0.5">{data?.total ?? 0} purchase orders</p>
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
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Received</p>
                <p className="text-2xl font-bold text-heading mt-1">{receivedCount}</p>
                <p className="text-xs text-muted mt-0.5">Completed orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-[10px] bg-info-50 text-info-600 shrink-0">
                <Clock size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-bold text-heading mt-1">{pendingCount}</p>
                <p className="text-xs text-muted mt-0.5">Awaiting receipt</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-[10px] bg-danger-50 text-danger-600 shrink-0">
                <XCircle size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Cancelled</p>
                <p className="text-2xl font-bold text-heading mt-1">{cancelledCount}</p>
                <p className="text-xs text-muted mt-0.5">Orders cancelled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <FilterPills options={filters} value={activeFilter} onChange={onFilterChange} />

      {/* ERPNext-style filter bar + FilterGroup */}
      <PurchaseOrderFilters
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
        keyExtractor={(po) => po.name}
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
            <ShoppingCart size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No purchase orders found</p>
            <p className="text-xs text-muted">
              {hasActiveFilters
                ? "No purchase orders match the current filter."
                : "Create your first purchase order to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}

