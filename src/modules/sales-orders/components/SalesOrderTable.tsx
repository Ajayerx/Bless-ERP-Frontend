"use client"

import { ShoppingCart } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge } from "@/components/ui"
import { type SalesOrder, type SalesOrderListResponse } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  draft: "warning",
  confirmed: "info",
  completed: "success",
  cancelled: "default",
}

const fulfillmentVariant: Record<string, "success" | "warning" | "info" | "danger"> = {
  fulfilled: "success",
  partial: "warning",
  pending: "info",
  cancelled: "danger",
}

const columns: Column<SalesOrder>[] = [
  {
    key: "number",
    header: "Order",
    render: (so) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
          <ShoppingCart size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{so.number}</p>
          <p className="text-xs text-muted">{so.customerName}</p>
        </div>
      </div>
    ),
  },
  {
    key: "total",
    header: "Amount",
    className: "text-right",
    render: (so) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(so.total)}</span>,
  },
  {
    key: "deliveryDate",
    header: "Delivery",
    hideOnMobile: true,
    render: (so) => <span className="text-sm text-muted">{formatDate(so.deliveryDate)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (so) => <Badge variant={statusVariant[so.status] ?? "info"}>{so.status.charAt(0).toUpperCase() + so.status.slice(1)}</Badge>,
  },
  {
    key: "fulfillmentStatus",
    header: "Fulfillment",
    render: (so) => (
      <Badge variant={fulfillmentVariant[so.fulfillmentStatus] ?? "info"}>
        {so.fulfillmentStatus.charAt(0).toUpperCase() + so.fulfillmentStatus.slice(1)}
      </Badge>
    ),
  },
]

const FILTERS = ["All", "Draft", "Confirmed", "Completed", "Cancelled"] as const
type Filter = (typeof FILTERS)[number]

interface SalesOrderTableProps {
  data: SalesOrderListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (page: number) => void
  activeFilter: Filter
  onFilterChange: (filter: Filter) => void
  onRowClick?: (so: SalesOrder) => void
}

export default function SalesOrderTable({
  data,
  loading,
  search,
  onSearch,
  page,
  onPageChange,
  activeFilter,
  onFilterChange,
  onRowClick,
}: SalesOrderTableProps) {
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

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { onFilterChange(f); onPageChange(1) }}
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
        keyExtractor={(so) => so.id}
        searchable
        searchPlaceholder="Search sales orders..."
        searchQuery={search}
        onSearch={(q) => { onSearch(q); onPageChange(1) }}
        loading={loading}
        page={page}
        total={data?.total}
        pageSize={10}
        onPageChange={onPageChange}
        onRowClick={onRowClick}
      />
    </div>
  )
}
