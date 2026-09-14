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
  Printer,
  UserRound,
  Tag,
  PauseCircle,
  Package,
  Truck,
  Lock,
  CircleAlert,
  Info,
} from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge, FilterPills, ListBulkActions } from "@/components/ui"
import {
  getSalesOrderIndicator,
  type SalesOrder,
  type SalesOrderListResponse,
  type SalesOrderIndicator,
  type SalesOrderIndicatorLabel,
} from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"
import SalesOrderFilters, {
  type SalesOrderSort,
  type RFilter,
} from "./SalesOrderFilters"

const indicatorIcon: Record<SalesOrderIndicatorLabel, React.ReactNode> = {
  Draft: <Clock size={14} />,
  Overdue: <CircleAlert size={14} />,
  "On Hold": <PauseCircle size={14} />,
  "To Deliver and Bill": <Package size={14} />,
  "To Deliver": <Truck size={14} />,
  "To Bill": <FileText size={14} />,
  Completed: <CheckCircle2 size={14} />,
  Cancelled: <XCircle size={14} />,
  Closed: <Lock size={14} />,
  Submitted: <Info size={14} />,
}

function indicatorForLight(so: SalesOrder): SalesOrderIndicator {
  return getSalesOrderIndicator({
    docstatus: so.docstatus,
    status: so.rawStatus,
    skip_delivery_note: so.skipDeliveryNote,
    per_delivered: so.perDelivered,
    per_billed: so.perBilled,
    grand_total: so.total,
    delivery_date: so.deliveryDate,
  })
}

function buildColumns(
  actions: {
    onSubmitSingle: (name: string) => void
    onCancelSingle: (name: string) => void
    onDeleteSingle: (name: string) => void
    onAmendSingle: (name: string) => void
  },
  onCellFilter?: (chip: RFilter) => void,
): Column<SalesOrder>[] {
  return [
    {
      key: "number",
      header: "Order",
      width: "w-[30%]",
      title: (so) => `Order: ${so.number} · ${so.customerName}`,
      render: (so) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[10px] bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ShoppingCart size={16} />
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCellFilter?.({ field: "name", label: "ID", operator: "=", value: so.name })
              }}
              aria-label={`Filter by ID ${so.name}`}
              className="block max-w-full truncate font-semibold text-heading text-left cursor-pointer hover:text-primary-700 transition-colors"
            >
              {so.number}
            </button>
            <p className="text-xs text-muted truncate">{so.customerName}</p>
          </div>
        </div>
      ),
    },
    {
      key: "total",
      header: "Amount",
      align: "right",
      width: "w-[18%]",
      title: (so) => `Amount: ${formatCurrency(so.total)}`,
      render: (so) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(so.total)}</span>,
    },
    {
      key: "deliveryDate",
      header: "Delivery",
      width: "w-[18%]",
      render: (so) =>
        so.deliveryDate ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCellFilter?.({ field: "delivery_date", label: "Delivery Date", operator: "=", value: so.deliveryDate })
            }}
            aria-label={`Filter by delivery date ${so.deliveryDate}`}
            className="text-sm text-muted cursor-pointer hover:text-primary-700 transition-colors"
          >
            {formatDate(so.deliveryDate)}
          </button>
        ) : (
          <span className="text-sm text-muted">{formatDate(so.deliveryDate)}</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[22%]",
      render: (so) => {
        const indicator = indicatorForLight(so)
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCellFilter?.({ field: "status", label: "Status", operator: "=", value: indicator.label })
            }}
            aria-label={`Filter by status ${indicator.label}`}
            className="inline-flex cursor-pointer"
          >
            <Badge variant={indicator.variant} className="gap-1">
              {indicatorIcon[indicator.label]}
              {indicator.label}
            </Badge>
          </button>
        )
      },
    },

    {
      key: "actions",
      header: "",
      width: "w-[12%]",
      noTruncate: true,
      render: (so) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {so.docstatus === 0 && (
            <>
              <button
                onClick={() => actions.onSubmitSingle(so.name)}
                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="Submit"
              >
                <Send size={13} />
              </button>
              <button
                onClick={() => actions.onDeleteSingle(so.name)}
                className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {so.docstatus === 1 && (
            <button
              onClick={() => actions.onCancelSingle(so.name)}
              className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              title="Cancel"
            >
              <XCircle size={13} />
            </button>
          )}
          {so.docstatus === 2 && (
            <>
              <button
                onClick={() => actions.onAmendSingle(so.name)}
                className="p-1.5 text-muted hover:bg-gray-100 rounded-lg transition-colors"
                title="Amend"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={() => actions.onDeleteSingle(so.name)}
                className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]
}

interface SalesOrderTableProps {
  data: SalesOrderListResponse | null
  loading: boolean
  paginationMode?: "pages" | "loadMore"
  currentPageLength?: number
  onPageLengthChange?: (size: number) => void
  onLoadMore?: () => void
  filters: readonly string[]
  activeFilter: string
  onFilterChange: (filter: string) => void
  onRowClick?: (so: SalesOrder) => void
  onCellFilter?: (chip: RFilter) => void
  selectable?: boolean
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
  hasActiveFilters?: boolean
  hasDraftSelected: boolean
  hasSubmittedSelected: boolean
  hasCancelledSelected: boolean
  hasClosedSelected: boolean
  onSubmitSingle: (name: string) => void
  onCancelSingle: (name: string) => void
  onDeleteSingle: (name: string) => void
  onAmendSingle: (name: string) => void
  onBulkSubmit: () => void
  onBulkCancel: () => void
  onBulkAmend: () => void
  onBulkDelete: () => void
  onBulkClose: () => void
  onBulkExport: () => void
  onBulkPrint: () => void
  onBulkAssign: () => void
  onBulkClearAssign: () => void
  onBulkAddTags: () => void
  filterChips?: RFilter[]
  onFilterChipsChange?: (filterChips: RFilter[]) => void
  customerSearch?: (query: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  companySearch?: (query: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  sort?: SalesOrderSort
}

export default function SalesOrderTable({
  data,
  loading,
  paginationMode,
  currentPageLength,
  onPageLengthChange,
  onLoadMore,
  filters,
  activeFilter,
  onFilterChange,
  onRowClick,
  onCellFilter,
  selectable,
  selectedKeys,
  onSelectionChange,
  hasActiveFilters,
  hasDraftSelected,
  hasSubmittedSelected,
  hasCancelledSelected,
  hasClosedSelected,
  onSubmitSingle,
  onCancelSingle,
  onDeleteSingle,
  onAmendSingle,
  onBulkSubmit,
  onBulkCancel,
  onBulkAmend,
  onBulkDelete,
  onBulkClose,
  onBulkExport,
  onBulkPrint,
  onBulkAssign,
  onBulkClearAssign,
  onBulkAddTags,
  filterChips,
  onFilterChipsChange,
  customerSearch,
  companySearch,
  sort,
}: SalesOrderTableProps) {
  const bulkToolbar = (
    <ListBulkActions
      count={selectedKeys?.size ?? 0}
      noun="sales orders"
      fallback={null}
      items={[
        { label: "Submit", icon: <Send size={14} />, show: hasDraftSelected, onClick: onBulkSubmit },
        { label: "Cancel", icon: <XCircle size={14} />, show: hasSubmittedSelected, danger: true, onClick: onBulkCancel },
        { label: "Amend", icon: <RotateCcw size={14} />, show: hasCancelledSelected, onClick: onBulkAmend },
        { label: "Delete", icon: <Trash2 size={14} />, show: hasDraftSelected || hasCancelledSelected, danger: true, onClick: onBulkDelete },
        { label: "Close", icon: <Lock size={14} />, show: hasSubmittedSelected && !hasClosedSelected, onClick: onBulkClose },
        { label: "Export", icon: <Download size={14} />, separatorBefore: true, onClick: onBulkExport },
        { label: "Print", icon: <Printer size={14} />, onClick: onBulkPrint },
        { label: "Assign to...", icon: <UserRound size={14} />, onClick: onBulkAssign },
        { label: "Clear Assignment", icon: <UserRound size={14} />, onClick: onBulkClearAssign },
        { label: "Add Tags", icon: <Tag size={14} />, onClick: onBulkAddTags },
      ]}
    />
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Orders</p>
            <p className="text-2xl font-bold text-heading mt-1.5">{data?.total ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">All orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Confirmed</p>
            <p className="text-2xl font-bold text-info-600 mt-1.5">{data?.items?.filter((o) => o.status === "confirmed").length ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">In progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Fulfilled</p>
            <p className="text-2xl font-bold text-success-600 mt-1.5">{data?.items?.filter((o) => o.fulfillmentStatus === "fulfilled").length ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Pending Fulfillment</p>
            <p className="text-2xl font-bold text-warning-600 mt-1.5">{data?.items?.filter((o) => o.fulfillmentStatus === "pending").length ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Awaiting shipment</p>
          </CardContent>
        </Card>
      </div>

      <FilterPills
        options={filters}
        value={activeFilter}
        onChange={onFilterChange}
      />

      <SalesOrderFilters
        filters={filterChips ?? []}
        onFiltersChange={(next) => onFilterChipsChange?.(next)}
        customerSearch={customerSearch}
        companySearch={companySearch}
        sort={sort}
      />

      <DataTable
        columns={buildColumns({ onSubmitSingle, onCancelSingle, onDeleteSingle, onAmendSingle }, onCellFilter)}
        data={data?.items ?? []}
        keyExtractor={(so) => so.name}
        loading={loading}
        total={data?.total}
        pageSize={currentPageLength ?? 20}
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
            <p className="font-semibold text-body">No sales orders found</p>
            <p className="text-xs text-muted">
              {hasActiveFilters
                ? "No sales orders match the current filters."
                : "Create your first sales order to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}