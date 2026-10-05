"use client"

import { Landmark, Ban, CheckCircle, Users, Download, Trash2 } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge, FilterPills, ListBulkActions } from "@/components/ui"
import type { BankAccount, BankAccountListResponse } from "@/services"
import BankAccountFilters, { type RFilter, type BankAccountSort } from "./BankAccountFilters"

const BANK_ACCOUNT_STATUS_FILTERS = ["All", "Enabled", "Disabled"]

export function bankAccountEnabled(ba: Pick<BankAccount, "disabled">): boolean {
  return (ba.disabled ?? 0) !== 1
}

function buildColumns(onCellFilter?: (chip: RFilter) => void): Column<BankAccount>[] {
  return [
    {
      key: "account_name",
      header: "Account",
      width: "w-[26%]",
      title: (a) => `Account: ${a.account_name}`,
      render: (a) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-[10px] bg-primary-50 text-primary-600 shrink-0">
            <Landmark size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-body truncate">{a.account_name}</p>
            <span
              className="text-xs text-muted truncate cursor-pointer hover:text-primary-700 hover:underline block"
              onClick={(e) => {
                e.stopPropagation()
                onCellFilter?.({ field: "account_name", label: "Account Name", operator: "=", value: a.account_name })
              }}
              title={`Filter by ${a.account_name}`}
            >
              {a.name}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "bank",
      header: "Bank",
      width: "w-[18%]",
      title: (a) => `Bank: ${a.bank || "—"}`,
      render: (a) => (
        <span
          className="text-sm text-muted truncate cursor-pointer hover:text-primary-700 hover:underline inline-block"
          onClick={(e) => {
            e.stopPropagation()
            onCellFilter?.({ field: "bank", label: "Bank", operator: "=", value: a.bank ?? "" })
          }}
        >
          {a.bank || "—"}
        </span>
      ),
    },
    {
      key: "company",
      header: "Company",
      width: "w-[16%]",
      title: (a) => `Company: ${a.company || a.party_type || "—"}`,
      render: (a) => (
        <span
          className="text-sm text-muted truncate cursor-pointer hover:text-primary-700 hover:underline inline-block"
          onClick={(e) => {
            e.stopPropagation()
            if ((a.is_company_account ?? 0) === 1 && a.company) {
              onCellFilter?.({ field: "company", label: "Company", operator: "=", value: a.company })
            }
          }}
        >
          {a.company || (a.party_type ? `${a.party_type} · ${a.party ?? ""}` : "—")}
        </span>
      ),
    },
    {
      key: "account_type",
      header: "Type",
      width: "w-[12%]",
      title: (a) => `Type: ${a.account_type || "—"}`,
      render: (a) => <span className="text-sm text-muted">{a.account_type || "—"}</span>,
    },
    {
      key: "is_default",
      header: "Default",
      width: "w-[9%]",
      align: "right",
      title: (a) => `Default: ${(a.is_default ?? 0) === 1 ? "Yes" : "No"}`,
      render: (a) => (
        <span className={`text-sm font-semibold tabular-nums ${(a.is_default ?? 0) === 1 ? "text-primary-700" : "text-muted"}`}>
          {(a.is_default ?? 0) === 1 ? "Yes" : "No"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[15%]",
      title: (a) => `Status: ${(a.is_company_account ?? 0) === 1 ? "Company Account" : "Party"} · ${bankAccountEnabled(a) ? "Enabled" : "Disabled"}`,
      render: (a) => (
        <div className="flex items-center gap-1.5">
          {(a.is_company_account ?? 0) === 1 ? (
            <Badge variant="info">Company</Badge>
          ) : (
            <Badge variant="purple">{a.party_type || "Party"}</Badge>
          )}
          <Badge variant={bankAccountEnabled(a) ? "success" : "default"}>
            {bankAccountEnabled(a) ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      ),
    },
  ]
}

interface BankAccountTableProps {
  data: BankAccountListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  filters?: string[]
  activeFilter?: string
  onFilterChange?: (filter: string) => void
  filterChips?: RFilter[]
  onFilterChipsChange?: (filterChips: RFilter[]) => void
  onCellFilter?: (chip: RFilter) => void
  bankSearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  companySearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  partySearch?: (q: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>
  sort?: BankAccountSort
  hasActiveFilters: boolean
  onRowClick?: (account: BankAccount) => void
  selectable?: boolean
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
  toolbarActions?: React.ReactNode
  pageLength: number
  onPageLengthChange: (size: number) => void
  onLoadMore: () => void
}

export default function BankAccountTable({
  data,
  loading,
  search,
  onSearch,
  filters,
  activeFilter,
  onFilterChange,
  filterChips,
  onFilterChipsChange,
  onCellFilter,
  bankSearch,
  companySearch,
  partySearch,
  sort,
  hasActiveFilters,
  onRowClick,
  selectable,
  selectedKeys,
  onSelectionChange,
  toolbarActions,
  pageLength,
  onPageLengthChange,
  onLoadMore,
}: BankAccountTableProps) {
  const allItems = data?.items ?? []
  const disabledCount = allItems.filter((a) => !bankAccountEnabled(a)).length
  const companyCount = allItems.filter((a) => (a.is_company_account ?? 0) === 1).length
  const defaultCount = allItems.filter((a) => (a.is_default ?? 0) === 1).length

  const bulkToolbar = toolbarActions ?? (
    <ListBulkActions
      count={selectedKeys?.size ?? 0}
      noun="bank accounts"
      fallback={null}
      items={[
        { label: "Delete", icon: <Trash2 size={14} />, danger: true, onClick: () => {} },
        { label: "Export", icon: <Download size={14} />, separatorBefore: true, onClick: () => {} },
      ]}
    />
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-[10px] bg-primary-50 text-primary-600 shrink-0">
            <Landmark size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">Total Accounts</p>
            <p className="text-2xl font-bold text-heading tracking-tight mt-0.5 tabular-nums">{data?.total ?? 0}</p>
            <p className="text-xs text-muted mt-0.5 truncate">{companyCount} company-linked</p>
          </div>
        </div>
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-[10px] bg-success-50 text-success-600 shrink-0">
            <CheckCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">Defaults</p>
            <p className="text-2xl font-bold text-heading tracking-tight mt-0.5 tabular-nums">{defaultCount}</p>
            <p className="text-xs text-muted mt-0.5 truncate">Scoped to party/company</p>
          </div>
        </div>
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-[10px] bg-warning-50 text-warning-600 shrink-0">
            <Users size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">Party Accounts</p>
            <p className="text-2xl font-bold text-heading tracking-tight mt-0.5 tabular-nums">{allItems.length - companyCount}</p>
            <p className="text-xs text-muted mt-0.5 truncate">Customer / supplier linked</p>
          </div>
        </div>
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-[10px] bg-gray-100 text-muted shrink-0">
            <Ban size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">Disabled</p>
            <p className="text-2xl font-bold text-heading tracking-tight mt-0.5 tabular-nums">{disabledCount}</p>
            <p className="text-xs text-muted mt-0.5 truncate">Inactive accounts</p>
          </div>
        </div>
      </div>

      <FilterPills
        options={filters ?? BANK_ACCOUNT_STATUS_FILTERS}
        value={activeFilter ?? "All"}
        onChange={(f) => onFilterChange?.(f)}
      />

      <BankAccountFilters
        filters={filterChips ?? []}
        onFiltersChange={(next) => onFilterChipsChange?.(next)}
        bankSearch={bankSearch}
        companySearch={companySearch}
        partySearch={partySearch}
        sort={sort}
      />

      <DataTable
        columns={buildColumns(onCellFilter)}
        data={allItems}
        keyExtractor={(a) => a.name}
        searchable searchPlaceholder="Search bank accounts..."
        searchQuery={search}
        onSearch={onSearch}
        loading={loading}
        total={data?.total}
        pageSize={pageLength}
        onRowClick={onRowClick}
        selectable={selectable}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        toolbarActions={bulkToolbar}
        paginationMode="loadMore"
        currentPageLength={pageLength}
        onPageLengthChange={onPageLengthChange}
        onLoadMore={onLoadMore}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-4">
            <Landmark size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No bank accounts found</p>
            <p className="text-xs text-muted">
              {hasActiveFilters || search
                ? "No bank accounts match the current filter."
                : "Add a bank account to get started."}
            </p>
          </div>
        }
      />
    </div>
  )
}