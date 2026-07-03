"use client"

import { FileText, CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge } from "@/components/ui"
import { type Quotation, type QuotationListResponse } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

const statusConfig: Record<string, { variant: "success" | "warning" | "danger" | "info" | "default"; icon: React.ReactNode }> = {
  draft: { variant: "warning", icon: <Clock size={14} /> },
  sent: { variant: "info", icon: <FileText size={14} /> },
  accepted: { variant: "success", icon: <CheckCircle2 size={14} /> },
  declined: { variant: "danger", icon: <XCircle size={14} /> },
  converted: { variant: "success", icon: <ArrowRight size={14} /> },
}

const columns: Column<Quotation>[] = [
  {
    key: "number",
    header: "Quotation",
    render: (q) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
          <FileText size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{q.number}</p>
          <p className="text-xs text-muted">{q.customerName}</p>
        </div>
      </div>
    ),
  },
  {
    key: "total",
    header: "Amount",
    className: "text-right",
    render: (q) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(q.total)}</span>,
  },
  {
    key: "issueDate",
    header: "Date",
    hideOnMobile: true,
    render: (q) => <span className="text-sm text-muted">{formatDate(q.issueDate)}</span>,
  },
  {
    key: "validUntil",
    header: "Valid Until",
    hideOnMobile: true,
    render: (q) => <span className="text-sm text-muted">{formatDate(q.validUntil)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (q) => {
      const cfg = statusConfig[q.status] ?? statusConfig.draft
      return <Badge variant={cfg.variant} className="gap-1">{cfg.icon}{q.status.charAt(0).toUpperCase() + q.status.slice(1)}</Badge>
    },
  },
]

const FILTERS = ["All", "Draft", "Sent", "Accepted", "Declined", "Converted"] as const
type Filter = (typeof FILTERS)[number]

interface QuotationTableProps {
  data: QuotationListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (page: number) => void
  activeFilter: Filter
  onFilterChange: (filter: Filter) => void
  onRowClick?: (quotation: Quotation) => void
}

export default function QuotationTable({
  data, loading, search, onSearch, page, onPageChange, activeFilter, onFilterChange, onRowClick,
}: QuotationTableProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-heading mt-1.5">{data?.total ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Quotations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Accepted</p>
            <p className="text-2xl font-bold text-success-600 mt-1.5">{data?.items?.filter((q) => q.status === "accepted").length ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Ready to convert</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Declined</p>
            <p className="text-2xl font-bold text-danger-600 mt-1.5">{data?.items?.filter((q) => q.status === "declined").length ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Lost quotations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Converted</p>
            <p className="text-2xl font-bold text-info-600 mt-1.5">{data?.items?.filter((q) => q.status === "converted").length ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Became invoices</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => { onFilterChange(f); onPageChange(1) }}
            className={cn("px-4 py-1.5 rounded-[10px] text-sm font-semibold transition-colors",
              activeFilter === f ? "bg-primary-600 text-white shadow-sm" : "text-muted hover:bg-gray-100 hover:text-body")}>
            {f}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns} data={data?.items ?? []} keyExtractor={(q) => q.id}
        searchable searchPlaceholder="Search quotations..." searchQuery={search}
        onSearch={(q) => { onSearch(q); onPageChange(1) }}
        loading={loading} page={page} total={data?.total} pageSize={10} onPageChange={onPageChange}
        onRowClick={onRowClick}
      />
    </div>
  )
}
