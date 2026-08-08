"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, Clock, FileText, DollarSign, Send, XCircle, RotateCcw, Trash2, X, Download, Printer, UserRound, Tag, ArrowUp, ArrowDown } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge, DateRangePicker, Avatar } from "@/components/ui"
import { type PaymentEntry, type PaymentEntryListResponse } from "@/services"
import { paymentService } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

type StatusFilter = "All" | "Draft" | "Submitted" | "Cancelled"

const STATUS_FILTERS: StatusFilter[] = ["All", "Draft", "Submitted", "Cancelled"]

const PAYMENT_TYPES = ["", "Receive", "Pay", "Internal Transfer"]

function SummaryCard({
  label, value, sub, icon: Icon, iconClass, iconBg,
}: {
  label: string; value: string | number; sub: string
  icon: React.ElementType; iconClass: string; iconBg: string
}) {
  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
      <div className={cn("p-2.5 rounded-[10px] shrink-0", iconBg, iconClass)}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-heading tracking-tight mt-0.5">{value}</p>
        <p className="text-xs text-muted mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

function statusIndicator(docstatus: number) {
  if (docstatus === 1) return <Badge variant="success">Submitted</Badge>
  if (docstatus === 2) return <Badge variant="danger">Cancelled</Badge>
  return <Badge variant="warning">Draft</Badge>
}

// Parse ERPNext `_assign` (a JSON array string of user ids) into a user id list.
function assigneesOf(payment: PaymentEntry): string[] {
  if (!payment._assign) return []
  try {
    const parsed = JSON.parse(payment._assign)
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : []
  } catch {
    return []
  }
}

interface PaymentTableProps {
  data: PaymentEntryListResponse | null
  loading: boolean
  onRowClick?: (payment: PaymentEntry) => void
  unpaidCount?: number
  overdueCount?: number
  selectedPayments: string[]
  onSelectionChange: (keys: string[]) => void
  onBulkSubmit: () => void
  onBulkCancel: () => void
  onBulkDelete: () => void
  onSubmitSingle: (name: string) => void
  onCancelSingle: (name: string) => void
  onDeleteSingle: (name: string) => void
  onAmendSingle: (name: string) => void
  activeStatus: StatusFilter
  onStatusFilterChange: (f: StatusFilter) => void
  paymentTypeFilter: string
  onPaymentTypeFilterChange: (v: string) => void
  modeFilter: string
  onModeFilterChange: (v: string) => void
  partyTypeFilter: string
  onPartyTypeFilterChange: (v: string) => void
  partyTypeOptions: string[]
  searchQuery: string
  onSearchQueryChange: (v: string) => void
  onBulkExport: () => void
  onBulkPrint: () => void
  onBulkAssign: () => void
  onBulkAddTags: () => void
  sortField?: string
  sortOrder?: "asc" | "desc"
  onSortChange?: (field: string, order: "asc" | "desc") => void
  dateFrom: string
  onDateFromChange: (v: string) => void
  dateTo: string
  onDateToChange: (v: string) => void
  assigneeFilter: string
  onAssigneeFilterChange: (v: string) => void
  nameFilter: string
  onFilterId: (name: string) => void
  onFilterType: (type: string) => void
  onFilterStatus: (docstatus: number) => void
  onResetFilters: () => void
  hasActiveFilters: boolean
  paginationMode?: "pages" | "loadMore"
  currentPageLength?: number
  onPageLengthChange?: (length: number) => void
  onLoadMore?: () => void
}

export default function PaymentTable({
  data, loading, onRowClick,
  unpaidCount = 0, overdueCount = 0,
  selectedPayments, onSelectionChange,
  onBulkSubmit, onBulkCancel, onBulkDelete,
  onSubmitSingle, onCancelSingle, onDeleteSingle, onAmendSingle,
  activeStatus, onStatusFilterChange,
  paymentTypeFilter, onPaymentTypeFilterChange,
  modeFilter, onModeFilterChange,
  partyTypeFilter, onPartyTypeFilterChange, partyTypeOptions,
  searchQuery, onSearchQueryChange,
  onBulkExport, onBulkPrint, onBulkAssign, onBulkAddTags,
  sortField, sortOrder, onSortChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  assigneeFilter, onAssigneeFilterChange,
  nameFilter, onFilterId, onFilterType, onFilterStatus,
  onResetFilters, hasActiveFilters,
  paginationMode = "loadMore",
  currentPageLength,
  onPageLengthChange,
  onLoadMore,
}: PaymentTableProps) {
  const [modeOptions, setModeOptions] = useState<string[]>([])

  useEffect(() => {
    paymentService.getModeOfPaymentList().then(setModeOptions)
  }, [])

  // Resolve assignee user ids → full names for row avatars (ERPNext shows the
  // name as a tooltip on hover). The list API returns only the ids.
  const [userNames, setUserNames] = useState<Record<string, { full_name?: string }>>({})

  useEffect(() => {
    const ids: string[] = []
    for (const p of data?.items ?? []) {
      ids.push(...assigneesOf(p))
    }
    const unique = Array.from(new Set(ids))
    if (unique.length === 0) {
      setUserNames({})
      return
    }
    let cancelled = false
    paymentService.resolveUserNames(unique).then((names) => {
      if (!cancelled) setUserNames(names)
    })
    return () => {
      cancelled = true
    }
  }, [data?.items])

  const totalCollected = data?.items?.reduce((s, p) => s + p.paid_amount, 0) ?? 0

  const paymentColumns: Column<PaymentEntry>[] = [
    {
      key: "party_name",
      header: "Customer",
      width: "w-[18%]",
      title: (p) => `Customer: ${p.party_name || p.party} · ${p.name}`,
      render: (p) => (
        <div className="min-w-0">
          <p className="font-semibold text-heading truncate">{p.party_name || p.party}</p>
          {/* ID behaves like ERPNext's detached ID column: clicking it filters */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onFilterId(p.name)
            }}
            title="Filter by this ID (click row to open)"
            className={cn(
              "text-xs truncate max-w-full text-left rounded px-1 -mx-1 transition-colors cursor-pointer",
              nameFilter === p.name
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-muted hover:text-primary-700 hover:bg-gray-100"
            )}
          >
            {p.name}
          </button>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[11%]",
      title: (p) => `Status: ${p.docstatus === 1 ? "Submitted" : p.docstatus === 2 ? "Cancelled" : "Draft"}`,
      render: (p) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onFilterStatus(p.docstatus)
          }}
          title={`Filter by ${p.docstatus === 1 ? "Submitted" : p.docstatus === 2 ? "Cancelled" : "Draft"}`}
          className="rounded-lg -m-1 p-1 transition-colors hover:bg-gray-100 cursor-pointer"
        >
          {statusIndicator(p.docstatus)}
        </button>
      ),
    },
    {
      key: "payment_type",
      header: "Type",
      width: "w-[11%]",
      title: (p) => `Payment type: ${p.payment_type ?? "—"}`,
      render: (p) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (p.payment_type) onFilterType(p.payment_type)
          }}
          title={p.payment_type ? `Filter by ${p.payment_type}` : undefined}
          disabled={!p.payment_type}
          className={cn(
            "text-sm rounded px-1 -mx-1 transition-colors",
            paymentTypeFilter === p.payment_type
              ? "text-primary-700 font-semibold"
              : "text-muted hover:text-primary-700 hover:bg-gray-100",
            !p.payment_type && "cursor-default text-muted/50"
          )}
        >
          {p.payment_type || "—"}
        </button>
      ),
    },
    {
      key: "paid_amount",
      header: "Amount",
      align: "right",
      width: "w-[12%]",
      title: (p) => `Amount: ${formatCurrency(p.paid_amount)}`,
      render: (p) => (
        <span className="font-semibold tabular-nums text-success-600">
          {formatCurrency(p.paid_amount)}
        </span>
      ),
    },
    {
      key: "mode_of_payment",
      header: "Method",
      width: "w-[12%]",
      render: (p) => (
        <span className="text-sm text-muted">{p.mode_of_payment ?? "—"}</span>
      ),
    },
    {
      key: "assigned",
      header: "",
      width: "w-[12%]",
      noTruncate: true,
      title: (p) =>
        assigneesOf(p).length
          ? `Assigned to: ${assigneesOf(p)
              .map((u) => userNames[u]?.full_name || u)
              .join(", ")}`
          : "No assignee",
      render: (p) => {
        const users = assigneesOf(p)
        if (users.length === 0) {
          return null
        }
        const visible = users.slice(0, 3)
        const extra = users.slice(3)
        const extraNames = extra.map((u) => userNames[u]?.full_name || u).join(", ")
        return (
          <div className="flex -space-x-2 items-center" onClick={(e) => e.stopPropagation()}>
            {visible.map((uid) => {
              const name = userNames[uid]?.full_name || uid
              const active = assigneeFilter === uid
              return (
                <button
                  key={uid}
                  type="button"
                  title={name}
                  onClick={() => onAssigneeFilterChange(active ? "" : uid)}
                  className={cn(
                    "rounded-full transition-transform hover:-translate-y-0.5 border-2",
                    active ? "border-primary-500 ring-2 ring-primary-500/30" : "border-surface"
                  )}
                >
                  <Avatar name={name} size="sm" className="pointer-events-none" />
                </button>
              )
            })}
            {extra.length > 0 && (
              <span
                title={extraNames}
                className="h-7 w-7 -ml-2 rounded-full bg-gray-200 text-gray-600 text-[11px] font-semibold flex items-center justify-center border-2 border-surface select-none"
              >
                +{extra.length}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: "posting_date",
      header: "Date",
      width: "w-[10%]",
      render: (p) => (
        <span className="text-sm text-muted">{formatDate(p.posting_date)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-[10%]",
      render: (p) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {p.docstatus === 0 && (
            <>
              <button onClick={() => onSubmitSingle(p.name)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Submit">
                <Send size={13} />
              </button>
              <button onClick={() => onDeleteSingle(p.name)} className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors" title="Delete">
                <Trash2 size={13} />
              </button>
            </>
          )}
          {p.docstatus === 1 && (
            <button onClick={() => onCancelSingle(p.name)} className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors" title="Cancel">
              <XCircle size={13} />
            </button>
          )}
          {p.docstatus === 2 && (
            <>
              <button onClick={() => onAmendSingle(p.name)} className="p-1.5 text-muted hover:bg-gray-100 rounded-lg transition-colors" title="Amend">
                <RotateCcw size={13} />
              </button>
              <button onClick={() => onDeleteSingle(p.name)} className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors" title="Delete">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  const selectedSet = new Set(selectedPayments)

  const selectedStatuses = new Set(
    (data?.items ?? [])
      .filter((p) => selectedPayments.includes(p.name))
      .map((p) => p.docstatus)
  )
  const hasDraft = selectedStatuses.has(0)
  const hasSubmitted = selectedStatuses.has(1)
  const hasCancelled = selectedStatuses.has(2)
  const canSubmit = hasDraft && !hasSubmitted && !hasCancelled
  const canCancel = hasSubmitted && !hasDraft && !hasCancelled
  const canDelete = (hasDraft || hasCancelled) && !hasSubmitted

  const bulkToolbar = selectedPayments.length > 0 ? (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted font-medium">{selectedPayments.length} selected</span>
      {canSubmit && (
        <button
          onClick={onBulkSubmit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 rounded-[8px] hover:bg-primary-700 transition-colors"
        >
          <Send size={12} /> Submit
        </button>
      )}
      {canCancel && (
        <button
          onClick={onBulkCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-danger-600 bg-danger-50 border border-danger-100 rounded-[8px] hover:bg-danger-100 transition-colors"
        >
          <XCircle size={12} /> Cancel
        </button>
      )}
      {canDelete && (
        <button
          onClick={onBulkDelete}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-danger-600 bg-danger-50 border border-danger-100 rounded-[8px] hover:bg-danger-100 transition-colors"
        >
          <Trash2 size={12} /> Delete
        </button>
      )}
      <button
        onClick={onBulkExport}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-body bg-surface border border-border rounded-[8px] hover:bg-gray-100 transition-colors"
        title="Export selected records (CSV/Excel)"
      >
        <Download size={12} /> Export
      </button>
      <button
        onClick={onBulkPrint}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-body bg-surface border border-border rounded-[8px] hover:bg-gray-100 transition-colors"
        title="Print selected payments (PDF)"
      >
        <Printer size={12} /> Print
      </button>
      <button
        onClick={onBulkAssign}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-body bg-surface border border-border rounded-[8px] hover:bg-gray-100 transition-colors"
        title="Assign selected payments to a user"
      >
        <UserRound size={12} /> Assign
      </button>
      <button
        onClick={onBulkAddTags}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-body bg-surface border border-border rounded-[8px] hover:bg-gray-100 transition-colors"
        title="Add tags to selected payments"
      >
        <Tag size={12} /> Tags
      </button>
      <button
        onClick={() => onSelectionChange([])}
        className="text-xs text-muted hover:text-body transition-colors"
      >
        Clear
      </button>
    </div>
  ) : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard
          label="Collected"
          value={formatCurrency(totalCollected)}
          sub={`${data?.total ?? 0} payments`}
          icon={CheckCircle2}
          iconClass="text-success-600"
          iconBg="bg-success-50"
        />
        <SummaryCard
          label="Pending"
          value={unpaidCount}
          sub={`${unpaidCount} unpaid invoice${unpaidCount !== 1 ? "s" : ""}`}
          icon={Clock}
          iconClass="text-warning-600"
          iconBg="bg-warning-50"
        />
        <SummaryCard
          label="Overdue"
          value={overdueCount}
          sub={`${overdueCount} invoice${overdueCount !== 1 ? "s" : ""} past due`}
          icon={FileText}
          iconClass="text-danger-600"
          iconBg="bg-danger-50"
        />
      </div>

      {/* Status pill tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => onStatusFilterChange(f)}
            className={cn(
              "px-4 py-1.5 rounded-[10px] text-sm font-semibold transition-colors",
              activeStatus === f
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
        {/* Payment Type dropdown */}
        <select
          value={paymentTypeFilter}
          onChange={(e) => onPaymentTypeFilterChange(e.target.value)}
          className="h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        >
          <option value="">All Types</option>
          {PAYMENT_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Mode of Payment dropdown */}
        <select
          value={modeFilter}
          onChange={(e) => onModeFilterChange(e.target.value)}
          className="h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        >
          <option value="">All Methods</option>
          {modeOptions.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Party Type dropdown */}
        <select
          value={partyTypeFilter}
          onChange={(e) => onPartyTypeFilterChange(e.target.value)}
          className="h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        >
          <option value="">All Parties</option>
          {partyTypeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* General search (ID / party / title) */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search ID / party..."
          className="h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors w-44"
        />

        {/* Date range (single calendar picker) */}
        <DateRangePicker
          value={{ from: dateFrom || undefined, to: dateTo || undefined }}
          onChange={(range) => {
            onDateFromChange(range.from ?? "")
            onDateToChange(range.to ?? "")
          }}
          className="w-52"
        />

        {/* Single sort control (ERPNext SortSelector): field dropdown + one order toggle */}
        <div className="h-9 flex items-center rounded-[10px] border border-border bg-surface text-body focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 transition-colors overflow-hidden">
          <span className="pl-3 pr-1 text-xs font-semibold text-muted uppercase tracking-wider">Sort</span>
          <select
            value={sortField || "posting_date"}
            onChange={(e) => onSortChange?.(e.target.value, sortOrder ?? "desc")}
            className="h-full bg-transparent text-sm focus:outline-none text-body cursor-pointer"
            title="Sort field"
          >
            <option value="posting_date">Posting Date</option>
            <option value="party_name">Customer</option>
            <option value="paid_amount">Amount</option>
            <option value="mode_of_payment">Method</option>
          </select>
          <button
            type="button"
            onClick={() => onSortChange?.(sortField ?? "posting_date", (sortOrder ?? "desc") === "asc" ? "desc" : "asc")}
            className="h-full px-2.5 flex items-center justify-center text-muted hover:text-primary-700 hover:bg-gray-100 transition-colors"
            title={(sortOrder ?? "desc") === "asc" ? "Sort ascending — click for descending" : "Sort descending — click for ascending"}
            aria-label={`Sort ${sortField ?? "posting_date"} ${sortOrder ?? "desc"}`}
          >
            {(sortOrder ?? "desc") === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>
        </div>

        {/* Clear filters */}
        {nameFilter && (
          <button
            onClick={() => onFilterId(nameFilter)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200 rounded-[8px] hover:bg-primary-100 transition-colors"
          >
            <FileText size={12} />
            ID: {nameFilter}
            <X size={12} />
          </button>
        )}
        {assigneeFilter && (
          <button
            onClick={() => onAssigneeFilterChange("")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200 rounded-[8px] hover:bg-primary-100 transition-colors"
          >
            <UserRound size={12} />
            Assigned to: {userNames[assigneeFilter]?.full_name || assigneeFilter}
            <X size={12} />
          </button>
        )}
        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted hover:text-body hover:bg-gray-100 rounded-[8px] transition-colors"
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      <section className="space-y-4">
        <DataTable
          columns={paymentColumns}
          data={data?.items ?? []}
          keyExtractor={(p) => p.name}
          loading={loading}
          total={data?.total}
          pageSize={currentPageLength ?? 20}
          onRowClick={onRowClick}
          selectable
          selectedKeys={selectedSet}
          onSelectionChange={(keys) => onSelectionChange(Array.from(keys))}
          toolbarActions={bulkToolbar}
          paginationMode={paginationMode}
          currentPageLength={currentPageLength}
          onPageLengthChange={onPageLengthChange}
          onLoadMore={onLoadMore}
          sortField={sortField}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          emptyState={
            <div className="flex flex-col items-center gap-2 py-4">
              <DollarSign size={32} className="text-muted opacity-40" />
              <p className="font-semibold text-body">No payments found</p>
              <p className="text-xs text-muted">
                {hasActiveFilters
                  ? "No payments match the current filters."
                  : "Record a payment against an unpaid invoice above."}
              </p>
            </div>
          }
        />
      </section>
    </div>
  )
}
