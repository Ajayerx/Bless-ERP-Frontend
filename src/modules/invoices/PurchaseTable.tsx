"use client"

import { ShoppingCart, CheckCircle2, Clock, XCircle, FileText } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge } from "@/components/ui"
import { type PurchaseOrder, type PurchaseOrderListResponse } from "@/services/purchase_orders.service"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

type StatusFilter = "All" | "Draft" | "Sent" | "Received" | "Cancelled"

const STATUS_FILTERS: StatusFilter[] = [
  "All",
  "Draft",
  "Sent",
  "Received",
  "Cancelled",
]

const statusVariant: Record<string, "warning" | "info" | "success" | "danger" | "default"> = {
  draft: "warning",
  sent: "info",
  received: "success",
  cancelled: "default",
}

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
  iconBg,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ElementType
  iconClass: string
  iconBg: string
}) {
  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
      <div className={cn("p-2.5 rounded-[10px] shrink-0", iconBg, iconClass)}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">{label}</p>
        <p className="text-2xl font-bold text-heading tracking-tight mt-0.5">{value}</p>
        <p className="text-xs text-muted mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

const columns: Column<PurchaseOrder>[] = [
  {
    key: "number",
    header: "PO Number",
    render: (po) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
          <ShoppingCart size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{po.number}</p>
          <p className="text-xs text-muted">
            {formatDate(po.orderDate)}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "supplierName",
    header: "Supplier",
    render: (po) => <span className="text-sm text-body">{po.supplierName}</span>,
  },
  {
    key: "total",
    header: "Amount",
    className: "text-right",
    render: (po) => (
      <span className="font-semibold tabular-nums text-heading">{formatCurrency(po.total)}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (po) => (
      <Badge variant={statusVariant[po.status] ?? "default"}>
        {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
      </Badge>
    ),
  },
  {
    key: "expectedDate",
    header: "Expected",
    render: (po) => (
      <span className="text-sm text-muted">{formatDate(po.expectedDate)}</span>
    ),
  },
]

interface PurchaseTableProps {
  data: PurchaseOrderListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (page: number) => void
  activeFilter: StatusFilter
  onFilterChange: (filter: StatusFilter) => void
  onRowClick?: (po: PurchaseOrder) => void
}

export default function PurchaseTable({
  data,
  loading,
  search,
  onSearch,
  page,
  onPageChange,
  activeFilter,
  onFilterChange,
  onRowClick,
}: PurchaseTableProps) {
  const allItems = data?.items ?? []
  const totalAmount = allItems.reduce((s, po) => s + po.total, 0)
  const receivedAmount = allItems.filter((po) => po.status === "received").reduce((s, po) => s + po.total, 0)
  const pendingCount = allItems.filter((po) => po.status === "sent" || po.status === "draft").length
  const cancelledCount = allItems.filter((po) => po.status === "cancelled").length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Orders"
          value={formatCurrency(totalAmount)}
          sub={`${data?.total ?? 0} purchase orders`}
          icon={ShoppingCart}
          iconClass="text-warning-600"
          iconBg="bg-warning-50"
        />
        <SummaryCard
          label="Received"
          value={formatCurrency(receivedAmount)}
          sub="Completed orders"
          icon={CheckCircle2}
          iconClass="text-success-600"
          iconBg="bg-success-50"
        />
        <SummaryCard
          label="Pending"
          value={pendingCount}
          sub="Awaiting delivery"
          icon={Clock}
          iconClass="text-info-600"
          iconBg="bg-info-50"
        />
        <SummaryCard
          label="Cancelled"
          value={cancelledCount}
          sub="Orders cancelled"
          icon={XCircle}
          iconClass="text-danger-600"
          iconBg="bg-danger-50"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => {
              onFilterChange(f)
              onPageChange(1)
            }}
            className={cn(
              "px-4 py-1.5 rounded-[10px] text-sm font-semibold transition-colors",
              activeFilter === f
                ? "bg-primary-600 text-white shadow-sm"
                : "text-muted hover:bg-gray-100 hover:text-body",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(po) => po.id}
        searchable
        searchPlaceholder="Search purchase orders or suppliers..."
        searchQuery={search}
        onSearch={(q) => {
          onSearch(q)
          onPageChange(1)
        }}
        loading={loading}
        page={page}
        total={data?.total}
        pageSize={10}
        onPageChange={onPageChange}
        onRowClick={onRowClick}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-4">
            <ShoppingCart size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No purchase orders found</p>
            <p className="text-xs text-muted">
              {activeFilter !== "All"
                ? `No ${activeFilter.toLowerCase()} purchase orders.`
                : "Create your first purchase order to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}
