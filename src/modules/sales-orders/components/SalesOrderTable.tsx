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
} from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge, FilterPills, ListBulkActions } from "@/components/ui"
import { type SalesOrder, type SalesOrderListResponse, type SalesOrderStatus } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

const statusVariant: Record<SalesOrderStatus, "success" | "warning" | "danger" | "info" | "default"> = {
  Draft: "warning",
  "On Hold": "warning",
  "To Deliver and Bill": "warning",
  "To Bill": "warning",
  "To Deliver": "warning",
  Completed: "success",
  Cancelled: "default",
  Closed: "default",
}

const statusIcon: Record<SalesOrderStatus, React.ReactNode> = {
  Draft: <Clock size={14} />,
  "On Hold": <PauseCircle size={14} />,
  "To Deliver and Bill": <Package size={14} />,
  "To Bill": <FileText size={14} />,
  "To Deliver": <Truck size={14} />,
  Completed: <CheckCircle2 size={14} />,
  Cancelled: <XCircle size={14} />,
  Closed: <Lock size={14} />,
}

function buildColumns(actions: {
  onSubmitSingle: (name: string) => void
  onCancelSingle: (name: string) => void
  onDeleteSingle: (name: string) => void
  onAmendSingle: (name: string) => void
}): Column<SalesOrder>[] {
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
            <p className="font-semibold text-heading truncate">{so.number}</p>
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
      render: (so) => <span className="text-sm text-muted">{formatDate(so.deliveryDate)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "w-[22%]",
      render: (so) => (
        <Badge variant={statusVariant[so.rawStatus] ?? "info"} className="gap-1">
          {statusIcon[so.rawStatus]}
          {so.rawStatus}
        </Badge>
      ),
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
  search: string
  onSearch: (q: string) => void
  paginationMode?: "pages" | "loadMore"
  currentPageLength?: number
  onPageLengthChange?: (size: number) => void
  onLoadMore?: () => void
  filters: readonly string[]
  activeFilter: string
  onFilterChange: (filter: string) => void
  onRowClick?: (so: SalesOrder) => void
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
}

export default function SalesOrderTable({
  data,
  loading,
  search,
  onSearch,
  paginationMode,
  currentPageLength,
  onPageLengthChange,
  onLoadMore,
  filters,
  activeFilter,
  onFilterChange,
  onRowClick,
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

      <DataTable
        columns={buildColumns({ onSubmitSingle, onCancelSingle, onDeleteSingle, onAmendSingle })}
        data={data?.items ?? []}
        keyExtractor={(so) => so.name}
        searchable
        searchPlaceholder="Search sales orders..."
        searchQuery={search}
        onSearch={onSearch}
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