"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, Clock, FileText, DollarSign, Send, XCircle, RotateCcw, Trash2, X } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, Badge } from "@/components/ui"
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
  partySearch: string
  onPartySearchChange: (v: string) => void
  dateFrom: string
  onDateFromChange: (v: string) => void
  dateTo: string
  onDateToChange: (v: string) => void
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
  partySearch, onPartySearchChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
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

  const totalCollected = data?.items?.reduce((s, p) => s + p.paid_amount, 0) ?? 0

  const paymentColumns: Column<PaymentEntry>[] = [
    {
      key: "party_name",
      header: "Customer",
      width: "w-[22%]",
      title: (p) => `Customer: ${p.party_name || p.party} · ${p.name}`,
      render: (p) => (
        <div className="min-w-0">
          <p className="font-semibold text-heading truncate">{p.party_name || p.party}</p>
          <p className="text-xs text-muted truncate">{p.name}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[10%]",
      title: (p) => `Status: ${p.docstatus === 1 ? "Submitted" : p.docstatus === 2 ? "Cancelled" : "Draft"}`,
      render: (p) => statusIndicator(p.docstatus),
    },
    {
      key: "paid_amount",
      header: "Amount",
      align: "right",
      width: "w-[13%]",
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
      width: "w-[14%]",
      render: (p) => (
        <span className="text-sm text-muted">{p.mode_of_payment ?? "—"}</span>
      ),
    },
    {
      key: "reference_no",
      header: "Reference",
      width: "w-[16%]",
      render: (p) => (
        <span className="font-mono text-xs text-muted">
          {p.reference_no ?? "—"}
        </span>
      ),
    },
    {
      key: "posting_date",
      header: "Date",
      width: "w-[11%]",
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

        {/* Party search */}
        <input
          type="text"
          value={partySearch}
          onChange={(e) => onPartySearchChange(e.target.value)}
          placeholder="Search party..."
          className="h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors w-44"
        />

        {/* Date range */}
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
