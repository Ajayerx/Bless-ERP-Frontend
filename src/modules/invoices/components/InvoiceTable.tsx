"use client"

import { FileText, DollarSign, AlertTriangle, CheckCircle2, Users, X } from "lucide-react"
import { Button, Badge } from "@/components/ui"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { type SalesInvoice, type SalesInvoiceListResponse } from "@/services"
import { formatCurrency, cn, formatDate } from "@/lib/utils"

type StatusFilter = "All" | "Paid" | "Unpaid" | "Overdue" | "Draft" | "Cancelled"

const STATUS_FILTERS: StatusFilter[] = [
  "All",
  "Paid",
  "Unpaid",
  "Overdue",
  "Draft",
  "Cancelled",
]

const statusVariant: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  Paid: "success",
  Unpaid: "warning",
  Draft: "default",
  Overdue: "danger",
  Cancelled: "default",
  Submitted: "info",
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

function buildColumns(
  onRecordPayment: (inv: SalesInvoice) => void,
): Column<SalesInvoice>[] {
  return [
    {
      key: "name",
      header: "Invoice",
      render: (inv) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <FileText size={16} />
          </div>
          <div>
            <p className="font-semibold text-heading">{inv.name}</p>
            <p className="text-xs text-muted">{formatDate(inv.posting_date)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "customer_name",
      header: "Customer",
      render: (inv) => <span className="text-sm text-body">{inv.customer_name}</span>,
    },
    {
      key: "grand_total",
      header: "Amount",
      align: "right",
      render: (inv) => (
        <span className="font-semibold tabular-nums text-heading">{formatCurrency(inv.grand_total)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (inv) => (
        <Badge variant={statusVariant[inv.status] ?? "default"}>
          {inv.status}
        </Badge>
      ),
    },
    {
      key: "due_date",
      header: "Due Date",
      hideOnMobile: true,
      render: (inv) => {
        const isOverdue = inv.status === "Overdue"
        return (
          <span className={cn("text-xs", isOverdue ? "text-danger-600 font-semibold" : "text-muted")}>
            {formatDate(inv.due_date)}
          </span>
        )
      },
    },
    {
      key: "actions",
      header: "",
      render: (inv) => (
        <div className="flex items-center justify-end gap-2">
          {(inv.status === "Unpaid" || inv.status === "Overdue") && inv.docstatus === 1 && (
            <Button
              variant="success"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onRecordPayment(inv)
              }}
            >
              <DollarSign size={13} />
              Pay
            </Button>
          )}
        </div>
      ),
    },
  ]
}

interface InvoiceTableProps {
  data: SalesInvoiceListResponse | null
  loading: boolean
  page: number
  onPageChange: (page: number) => void
  activeFilter: StatusFilter
  onFilterChange: (filter: StatusFilter) => void
  onRowClick: (inv: SalesInvoice) => void
  onRecordPayment: (inv: SalesInvoice) => void
  customerSearch: string
  onCustomerSearchChange: (v: string) => void
  dateFrom: string
  onDateFromChange: (v: string) => void
  dateTo: string
  onDateToChange: (v: string) => void
  onResetFilters: () => void
  hasActiveFilters: boolean
  toolbarActions?: React.ReactNode
}

export default function InvoiceTable({
  data,
  loading,
  page,
  onPageChange,
  activeFilter,
  onFilterChange,
  onRowClick,
  onRecordPayment,
  customerSearch,
  onCustomerSearchChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onResetFilters,
  hasActiveFilters,
  toolbarActions,
}: InvoiceTableProps) {
  const allItems = data?.items ?? []
  const totalAmount = allItems.reduce((s, i) => s + i.grand_total, 0)
  const paidAmount = allItems.filter((i) => i.status === "Paid").reduce((s, i) => s + i.grand_total, 0)
  const overdueCount = allItems.filter((i) => i.status === "Overdue").length
  const customerCount = new Set(allItems.map((i) => i.customer)).size

  const columns = buildColumns(onRecordPayment)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Invoiced"
          value={formatCurrency(totalAmount)}
          sub={`${data?.total ?? 0} invoices`}
          icon={FileText}
          iconClass="text-primary-600"
          iconBg="bg-primary-50"
        />
        <SummaryCard
          label="Collected"
          value={formatCurrency(paidAmount)}
          sub="Paid invoices"
          icon={CheckCircle2}
          iconClass="text-success-600"
          iconBg="bg-success-50"
        />
        <SummaryCard
          label="Overdue"
          value={overdueCount}
          sub="Needs attention"
          icon={AlertTriangle}
          iconClass="text-danger-600"
          iconBg="bg-danger-50"
        />
        <SummaryCard
          label="Customers"
          value={customerCount}
          sub="On this page"
          icon={Users}
          iconClass="text-purple-600"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Status pill tabs */}
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

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Customer search */}
        <input
          type="text"
          value={customerSearch}
          onChange={(e) => onCustomerSearchChange(e.target.value)}
          placeholder="Search customer..."
          className="h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors w-48"
        />

        {/* Posting Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
          title="From date"
        />
        <span className="text-xs text-muted">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
          title="To date"
        />

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted hover:text-body hover:bg-gray-100 rounded-[8px] transition-colors"
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(inv) => inv.name}
        loading={loading}
        page={page}
        total={data?.total}
        pageSize={10}
        onPageChange={onPageChange}
        onRowClick={onRowClick}
        toolbarActions={toolbarActions}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-4">
            <FileText size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No invoices found</p>
            <p className="text-xs text-muted">
              {hasActiveFilters
                ? "No invoices match the current filters."
                : "Create your first invoice to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}
