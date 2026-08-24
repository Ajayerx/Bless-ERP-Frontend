"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, Clock, FileText, DollarSign, Send, XCircle, RotateCcw, Trash2, Download, Printer, UserRound, Tag } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge, ListFilterBar, Button, Avatar, ListBulkActions, FitText , FilterPills } from "@/components/ui"
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
        <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">{label}</p>
        <FitText className="text-2xl font-bold text-heading tracking-tight mt-0.5 tabular-nums">{value}</FitText>
        <p className="text-xs text-muted mt-0.5 truncate">{sub}</p>
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
  onBulkClearAssign: () => void
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
  onBulkExport, onBulkPrint, onBulkAssign, onBulkClearAssign, onBulkAddTags,
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

  const bulkToolbar = (
    <ListBulkActions
      count={selectedPayments.length}
      noun="payments"
      fallback={
        <Button variant="secondary" size="sm" onClick={onBulkExport}>
          <Download size={13} /> Export
        </Button>
      }
      items={[
        {
          label: "Submit",
          icon: <Send size={14} />,
          show: hasDraft,
          onClick: onBulkSubmit,
        },
        {
          label: "Cancel",
          icon: <XCircle size={14} />,
          show: hasSubmitted,
          danger: true,
          onClick: onBulkCancel,
        },
        {
          label: "Delete",
          icon: <Trash2 size={14} />,
          show: hasDraft || hasCancelled,
          danger: true,
          onClick: onBulkDelete,
        },
        {
          label: "Export",
          icon: <Download size={14} />,
          separatorBefore: true,
          onClick: onBulkExport,
        },
        {
          label: "Print",
          icon: <Printer size={14} />,
          onClick: onBulkPrint,
        },
        {
          label: "Assign to…",
          icon: <UserRound size={14} />,
          onClick: onBulkAssign,
        },
        {
          label: "Clear Assignment",
          icon: <UserRound size={14} />,
          onClick: onBulkClearAssign,
        },
        {
          label: "Add Tags",
          icon: <Tag size={14} />,
          onClick: onBulkAddTags,
        },
      ]}
    />
  )

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
      <FilterPills options={STATUS_FILTERS} value={activeStatus} onChange={onStatusFilterChange} />

      {/* Filter bar */}
      <ListFilterBar
        controls={{
          selects: [
            {
              value: paymentTypeFilter,
              onChange: onPaymentTypeFilterChange,
              placeholder: "All Types",
              options: PAYMENT_TYPES.filter(Boolean).map((t) => ({ value: t, label: t })),
            },
            {
              value: modeFilter,
              onChange: onModeFilterChange,
              placeholder: "All Methods",
              options: modeOptions.map((m) => ({ value: m, label: m })),
            },
            {
              value: partyTypeFilter,
              onChange: onPartyTypeFilterChange,
              placeholder: "All Parties",
              options: partyTypeOptions.map((t) => ({ value: t, label: t })),
            },
          ],
          search: {
            value: searchQuery,
            onChange: onSearchQueryChange,
            placeholder: "Search ID / party...",
            width: "w-44",
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
            field: sortField || "posting_date",
            order: sortOrder ?? "desc",
            onSort: onSortChange ?? (() => {}),
            options: [
              { value: "posting_date", label: "Posting Date" },
              { value: "party_name", label: "Customer" },
              { value: "paid_amount", label: "Amount" },
              { value: "mode_of_payment", label: "Method" },
            ],
          },
          chips: [
            ...(nameFilter
              ? [{
                  key: "name",
                  label: `ID: ${nameFilter}`,
                  icon: <FileText size={12} />,
                  onClear: () => onFilterId(nameFilter),
                }]
              : []),
            ...(assigneeFilter
              ? [{
                  key: "assignee",
                  label: `Assigned to: ${userNames[assigneeFilter]?.full_name || assigneeFilter}`,
                  icon: <UserRound size={12} />,
                  onClear: () => onAssigneeFilterChange(""),
                }]
              : []),
          ],
        }}
        hasActiveFilters={hasActiveFilters}
        onReset={onResetFilters}
      />

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
