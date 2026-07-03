"use client"

import { ShoppingBag, Mail, Phone } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge, Avatar } from "@/components/ui"
import { type Supplier, type SupplierListResponse } from "@/services"
import { formatCurrency } from "@/lib/utils"

const columns: Column<Supplier>[] = [
  {
    key: "name",
    header: "Supplier",
    render: (s) => (
      <div className="flex items-center gap-3">
        <Avatar name={s.name} size="sm" />
        <div>
          <p className="font-semibold text-heading">{s.name}</p>
          <p className="text-xs text-muted">{s.contactName}</p>
        </div>
      </div>
    ),
  },
  {
    key: "email",
    header: "Contact",
    hideOnMobile: true,
    render: (s) => (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs text-muted"><Mail size={12} />{s.email}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted"><Phone size={12} />{s.phone}</div>
      </div>
    ),
  },
  {
    key: "balance",
    header: "Balance",
    className: "text-right",
    render: (s) => (
      <span className="font-semibold tabular-nums text-heading">
        {s.balance > 0 ? formatCurrency(s.balance) : "—"}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (s) => (
      <Badge variant={s.status === "active" ? "success" : "default"}>
        {s.status === "active" ? "Active" : "Inactive"}
      </Badge>
    ),
  },
]

interface SupplierTableProps {
  data: SupplierListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (page: number) => void
  onRowClick?: (supplier: Supplier) => void
}

export default function SupplierTable({
  data, loading, search, onSearch, page, onPageChange, onRowClick,
}: SupplierTableProps) {
  return (
    <div className="space-y-6">
      {data && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <ShoppingBag size={16} />
          <span><strong className="text-heading">{data.total}</strong> total suppliers</span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(s) => s.id}
        searchable searchPlaceholder="Search suppliers..."
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
