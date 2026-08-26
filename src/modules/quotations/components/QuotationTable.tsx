"use client"

import { FileText, CheckCircle2, Clock, XCircle, ArrowRight, Users, TrendingDown, Send, RotateCcw, Trash2, Download, Printer, UserRound, Tag } from "lucide-react"
import { Badge, ListFilterBar, FitText, FilterPills, ListBulkActions } from "@/components/ui"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { type Quotation, type QuotationListResponse } from "@/services"
import type { QuotationStatus } from "../types"
import { formatCurrency, cn, formatDate } from "@/lib/utils"

type StatusFilter = "All" | QuotationStatus

const STATUS_FILTERS: StatusFilter[] = [
  "All",
  "Draft",
  "Open",
  "Replied",
  "Partially Ordered",
  "Ordered",
  "Lost",
  "Cancelled",
  "Expired",
]

const statusVariant: Record<QuotationStatus, "success" | "info" | "warning" | "danger" | "default"> = {
  Draft: "default",
  Open: "info",
  Replied: "info",
  "Partially Ordered": "warning",
  Ordered: "success",
  Lost: "danger",
  Cancelled: "default",
  Expired: "default",
}

const statusIcon: Record<QuotationStatus, React.ReactNode> = {
  Draft: <Clock size={14} />,
  Open: <FileText size={14} />,
  Replied: <FileText size={14} />,
  "Partially Ordered": <ArrowRight size={14} />,
  Ordered: <CheckCircle2 size={14} />,
  Lost: <XCircle size={14} />,
  Cancelled: <XCircle size={14} />,
  Expired: <Clock size={14} />,
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
        <FitText className="text-2xl font-bold text-heading tracking-tight mt-0.5 tabular-nums">{value}</FitText>
        <p className="text-xs text-muted mt-0.5 truncate">{sub}</p>
      </div>
    </div>
  )
}

function buildColumns(actions: {
  onSubmitSingle: (name: string) => void
  onCancelSingle: (name: string) => void
  onDeleteSingle: (name: string) => void
  onAmendSingle: (name: string) => void
}): Column<Quotation>[] {
  return [
    {
      key: "name",
      header: "Quotation",
      width: "w-[23%]",
      title: (q) => `Quotation: ${q.name} · ${q.customer_name || q.party_name}`,
      render: (q) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <FileText size={16} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-heading truncate">{q.name}</p>
            <p className="text-xs text-muted truncate">{q.customer_name || q.party_name}</p>
          </div>
        </div>
      ),
    },
    {
      key: "quotation_to",
      header: "Customer Type",
      width: "w-[13%]",
      render: (q) => <span className="text-sm text-body">{q.quotation_to}</span>,
    },
    {
      key: "grand_total",
      header: "Amount",
      align: "right",
      width: "w-[12%]",
      title: (q) => `Amount: ${formatCurrency(q.grand_total)}`,
      render: (q) => (
        <span className="font-semibold tabular-nums text-heading">{formatCurrency(q.grand_total)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[16%]",
      render: (q) => (
        <Badge variant={statusVariant[q.status] ?? "default"} className="gap-1">
          {statusIcon[q.status]}
          {q.status}
        </Badge>
      ),
    },
    {
      key: "transaction_date",
      header: "Date",
      width: "w-[12%]",
      render: (q) => <span className="text-sm text-muted">{formatDate(q.transaction_date)}</span>,
    },
    {
      key: "valid_till",
      header: "Valid Until",
      width: "w-[12%]",
      render: (q) => {
        const expired = q.status === "Expired" && !!q.valid_till
        return (
          <span className={cn("text-xs", expired ? "text-danger-600 font-semibold" : "text-muted")}>
            {q.valid_till ? formatDate(q.valid_till) : "—"}
          </span>
        )
      },
    },
    {
      key: "actions",
      header: "",
      width: "w-[12%]",
      noTruncate: true,
      render: (q) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {q.docstatus === 0 && (
            <>
              <button
                onClick={() => actions.onSubmitSingle(q.name)}
                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="Submit"
              >
                <Send size={13} />
              </button>
              <button
                onClick={() => actions.onDeleteSingle(q.name)}
                className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {q.docstatus === 1 && (
            <button
              onClick={() => actions.onCancelSingle(q.name)}
              className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              title="Cancel"
            >
              <XCircle size={13} />
            </button>
          )}
          {q.docstatus === 2 && (
            <>
              <button
                onClick={() => actions.onAmendSingle(q.name)}
                className="p-1.5 text-muted hover:bg-gray-100 rounded-lg transition-colors"
                title="Amend"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={() => actions.onDeleteSingle(q.name)}
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

interface QuotationTableProps {
  data: QuotationListResponse | null
  loading: boolean
  page: number
  onPageChange: (page: number) => void
  activeFilter: string
  onFilterChange: (filter: string) => void
  onRowClick: (quotation: Quotation) => void
  customerSearch: string
  onCustomerSearchChange: (v: string) => void
  dateFrom: string
  onDateFromChange: (v: string) => void
  dateTo: string
  onDateToChange: (v: string) => void
  validTillFrom: string
  onValidTillFromChange: (v: string) => void
  validTillTo: string
  onValidTillToChange: (v: string) => void
  assignedTo: string
  onAssigneeFilterChange: (v: string) => void
  sortField: string
  sortOrder: "asc" | "desc"
  onSortChange: (field: string, order: "asc" | "desc") => void
  onResetFilters: () => void
  hasActiveFilters: boolean
  selectable?: boolean
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
  paginationMode?: "pages" | "loadMore"
  currentPageLength?: number
  onPageLengthChange?: (size: number) => void
  onLoadMore?: () => void
  hasDraftSelected: boolean
  hasSubmittedSelected: boolean
  hasCancelledSelected: boolean
  onSubmitSingle: (name: string) => void
  onCancelSingle: (name: string) => void
  onDeleteSingle: (name: string) => void
  onAmendSingle: (name: string) => void
  onBulkSubmit: () => void
  onBulkCancel: () => void
  onBulkDelete: () => void
  onBulkExport: () => void
  onBulkPrint: () => void
  onBulkAssign: () => void
  onBulkClearAssign: () => void
  onBulkAddTags: () => void
}

export default function QuotationTable({
  data,
  loading,
  page,
  onPageChange,
  activeFilter,
  onFilterChange,
  onRowClick,
  customerSearch,
  onCustomerSearchChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  validTillFrom,
  onValidTillFromChange,
  validTillTo,
  onValidTillToChange,
  assignedTo,
  onAssigneeFilterChange,
  sortField,
  sortOrder,
  onSortChange,
  onResetFilters,
  hasActiveFilters,
  selectable,
  selectedKeys,
  onSelectionChange,
  paginationMode,
  currentPageLength,
  onPageLengthChange,
  onLoadMore,
  hasDraftSelected,
  hasSubmittedSelected,
  hasCancelledSelected,
  onSubmitSingle,
  onCancelSingle,
  onDeleteSingle,
  onAmendSingle,
  onBulkSubmit,
  onBulkCancel,
  onBulkDelete,
  onBulkExport,
  onBulkPrint,
  onBulkAssign,
  onBulkClearAssign,
  onBulkAddTags,
}: QuotationTableProps) {
  const allItems = data?.items ?? []
  const totalAmount = allItems.reduce((s, i) => s + (i.grand_total || 0), 0)
  const openAmount = allItems.filter((i) => i.status === "Open").reduce((s, i) => s + (i.grand_total || 0), 0)
  const draftCount = allItems.filter((i) => i.status === "Draft").length
  const lostCount = allItems.filter((i) => i.status === "Lost").length

  const bulkToolbar = (
    <ListBulkActions
      count={selectedKeys?.size ?? 0}
      noun="quotations"
      fallback={null}
      items={[
        { label: "Submit", icon: <Send size={14} />, show: hasDraftSelected, onClick: onBulkSubmit },
        { label: "Cancel", icon: <XCircle size={14} />, show: hasSubmittedSelected, danger: true, onClick: onBulkCancel },
        { label: "Delete", icon: <Trash2 size={14} />, show: hasDraftSelected || hasCancelledSelected, danger: true, onClick: onBulkDelete },
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
        <SummaryCard
          label="Total Quotations"
          value={formatCurrency(totalAmount)}
          sub={`${data?.total ?? 0} quotations`}
          icon={FileText}
          iconClass="text-primary-600"
          iconBg="bg-primary-50"
        />
        <SummaryCard
          label="Open"
          value={formatCurrency(openAmount)}
          sub="Active quotations"
          icon={CheckCircle2}
          iconClass="text-success-600"
          iconBg="bg-success-50"
        />
        <SummaryCard
          label="Draft"
          value={draftCount}
          sub="Not yet submitted"
          icon={Clock}
          iconClass="text-purple-600"
          iconBg="bg-purple-50"
        />
        <SummaryCard
          label="Lost"
          value={lostCount}
          sub="Declined or lost"
          icon={TrendingDown}
          iconClass="text-danger-600"
          iconBg="bg-danger-50"
        />
      </div>

      {/* Status pill tabs */}
      <FilterPills
        options={STATUS_FILTERS}
        value={activeFilter}
        onChange={(f) => {
          onFilterChange(f)
          onPageChange(1)
        }}
      />

      {/* Customer search + date filters + sort */}
      <ListFilterBar
        controls={{
          search: {
            value: customerSearch,
            onChange: onCustomerSearchChange,
            placeholder: "Search customer / ID...",
            width: "w-48",
          },
          dateRange: {
            from: dateFrom,
            to: dateTo,
            onChange: (from, to) => {
              onDateFromChange(from)
              onDateToChange(to)
            },
          },
          sort: {
            field: sortField || "transaction_date",
            order: sortOrder ?? "desc",
            onSort: onSortChange,
            options: [
              { value: "transaction_date", label: "Date" },
              { value: "party_name", label: "Customer" },
              { value: "grand_total", label: "Amount" },
              { value: "valid_till", label: "Valid Until" },
            ],
          },
          chips: [
            ...(validTillFrom || validTillTo
              ? [{
                  key: "validTill",
                  label: `Valid until: ${validTillFrom || "…"} → ${validTillTo || "…"}`,
                  icon: <Clock size={12} />,
                  onClear: () => {
                    onValidTillFromChange("")
                    onValidTillToChange("")
                  },
                }]
              : []),
            ...(assignedTo
              ? [{
                  key: "assignee",
                  label: `Assigned to: ${assignedTo}`,
                  icon: <Users size={12} />,
                  onClear: () => onAssigneeFilterChange(""),
                }]
              : []),
          ],
        }}
        hasActiveFilters={hasActiveFilters}
        onReset={onResetFilters}
      />

      <DataTable
        columns={buildColumns({ onSubmitSingle, onCancelSingle, onDeleteSingle, onAmendSingle })}
        data={allItems}
        keyExtractor={(q) => q.name}
        loading={loading}
        page={page}
        total={data?.total}
        pageSize={10}
        onPageChange={onPageChange}
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
            <FileText size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No quotations found</p>
            <p className="text-xs text-muted">
              {hasActiveFilters
                ? "No quotations match the current filters."
                : "Create your first quotation to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}