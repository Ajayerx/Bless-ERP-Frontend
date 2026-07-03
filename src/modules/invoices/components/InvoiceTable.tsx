"use client"

import { FileText, DollarSign, AlertTriangle, CheckCircle2, Users } from "lucide-react"
import { Button, Badge } from "@/components/ui"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { type Invoice, type InvoiceListResponse } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

type StatusFilter = "All" | "Paid" | "Sent" | "Overdue" | "Draft" | "Cancelled"

const STATUS_FILTERS: StatusFilter[] = [
  "All",
  "Paid",
  "Sent",
  "Overdue",
  "Draft",
  "Cancelled",
]

const statusVariant: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  paid: "success",
  sent: "info",
  draft: "warning",
  overdue: "danger",
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

function buildColumns(
  onRecordPayment: (inv: Invoice) => void,
): Column<Invoice>[] {
  return [
    {
      key: "number",
      header: "Invoice",
      render: (inv) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <FileText size={16} />
          </div>
          <div>
            <p className="font-semibold text-heading">{inv.number}</p>
            <p className="text-xs text-muted">
              {new Date(inv.issueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (inv) => <span className="text-sm text-body">{inv.customerName}</span>,
    },
    {
      key: "total",
      header: "Amount",
      className: "text-right",
      render: (inv) => (
        <span className="font-semibold tabular-nums text-heading">{formatCurrency(inv.total)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (inv) => (
        <Badge variant={statusVariant[inv.status] ?? "default"}>
          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: "dueDate",
      header: "Due Date",
      hideOnMobile: true,
      render: (inv) => {
        const isOverdue = inv.status === "overdue"
        return (
          <span
            className={cn(
              "text-xs",
              isOverdue ? "text-danger-600 font-semibold" : "text-muted",
            )}
          >
            {new Date(inv.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )
      },
    },
    {
      key: "actions",
      header: "",
      render: (inv) => (
        <div className="flex items-center justify-end gap-2">
          {(inv.status === "sent" || inv.status === "overdue") && (
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
          <Button variant="secondary" size="sm">
            View
          </Button>
        </div>
      ),
    },
  ]
}

interface InvoiceTableProps {
  data: InvoiceListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (page: number) => void
  activeFilter: StatusFilter
  onFilterChange: (filter: StatusFilter) => void
  onRowClick: (inv: Invoice) => void
  onRecordPayment: (inv: Invoice) => void
  toolbarActions?: React.ReactNode
}

export default function InvoiceTable({
  data,
  loading,
  search,
  onSearch,
  page,
  onPageChange,
  activeFilter,
  onFilterChange,
  onRowClick,
  onRecordPayment,
  toolbarActions,
}: InvoiceTableProps) {
  const allItems = data?.items ?? []
  const totalAmount = allItems.reduce((s, i) => s + i.total, 0)
  const paidAmount = allItems.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0)
  const overdueCount = allItems.filter((i) => i.status === "overdue").length
  const customerCount = new Set(allItems.map((i) => i.customerId)).size

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
        keyExtractor={(inv) => inv.id}
        searchable
        searchPlaceholder="Search invoices or customers..."
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
        toolbarActions={toolbarActions}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-4">
            <FileText size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No invoices found</p>
            <p className="text-xs text-muted">
              {activeFilter !== "All"
                ? `No ${activeFilter.toLowerCase()} invoices.`
                : "Create your first invoice to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}
