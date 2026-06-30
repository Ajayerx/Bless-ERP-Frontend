"use client"

import { FileText } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge } from "@/components/ui"
import { type Bill, type BillListResponse } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

const statusVariant: Record<string, "success" | "warning" | "danger" | "info"> = {
  paid: "success",
  received: "info",
  overdue: "danger",
}

const columns: Column<Bill>[] = [
  {
    key: "number",
    header: "Bill",
    render: (b) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
          <FileText size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{b.number}</p>
          <p className="text-xs text-muted">{b.supplierName}</p>
        </div>
      </div>
    ),
  },
  {
    key: "category",
    header: "Category",
    render: (b) => <span className="text-xs text-muted">{b.category}</span>,
  },
  {
    key: "amount",
    header: "Amount",
    className: "text-right",
    render: (b) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(b.amount)}</span>,
  },
  {
    key: "dueDate",
    header: "Due Date",
    render: (b) => (
      <span className={cn("text-sm", b.status === "overdue" ? "text-danger-600 font-semibold" : "text-muted")}>
        {formatDate(b.dueDate)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (b) => (
      <Badge variant={statusVariant[b.status] ?? "info"}>
        {b.status === "overdue" ? "Overdue" : b.status === "received" ? "Received" : "Paid"}
      </Badge>
    ),
  },
]

const FILTERS = ["All", "Received", "Paid", "Overdue"] as const
type Filter = (typeof FILTERS)[number]

interface BillTableProps {
  data: BillListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (page: number) => void
  activeFilter: Filter
  onFilterChange: (filter: Filter) => void
  onRowClick?: (bill: Bill) => void
}

export default function BillTable({
  data,
  loading,
  search,
  onSearch,
  page,
  onPageChange,
  activeFilter,
  onFilterChange,
  onRowClick,
}: BillTableProps) {
  const totalAmount = data?.items?.reduce((s, b) => s + b.amount, 0) ?? 0
  const overdueAmount = data?.items?.filter((b) => b.status === "overdue")?.reduce((s, b) => s + b.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Bills</p>
            <p className="text-2xl font-bold text-heading mt-1.5 tabular-nums">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-muted mt-0.5">{data?.total ?? 0} bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Overdue</p>
            <p className="text-2xl font-bold text-danger-600 mt-1.5 tabular-nums">{formatCurrency(overdueAmount)}</p>
            <p className="text-xs text-muted mt-0.5">Needs attention</p>
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
        keyExtractor={(b) => b.id}
        searchable
        searchPlaceholder="Search bills..."
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
