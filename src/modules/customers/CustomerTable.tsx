"use client"

import { Mail, Phone, Users } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge, Avatar } from "@/components/ui"
import { type Customer, type CustomerListResponse } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

const columns: Column<Customer>[] = [
  {
    key: "name",
    header: "Customer",
    render: (c) => (
      <div className="flex items-center gap-3">
        <Avatar name={c.name} size="sm" />
        <div>
          <p className="font-semibold text-heading">{c.name}</p>
          <p className="text-xs text-muted">{c.contactName}</p>
        </div>
      </div>
    ),
  },
  {
    key: "email",
    header: "Contact",
    hideOnMobile: true,
    render: (c) => (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Mail size={12} />
          {c.email}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Phone size={12} />
          {c.phone}
        </div>
      </div>
    ),
  },
  {
    key: "outstanding",
    header: "Outstanding",
    className: "text-right",
    render: (c) => (
      <span className={cn("font-semibold tabular-nums", c.outstanding > 0 ? "text-heading" : "text-muted")}>
        {c.outstanding > 0 ? formatCurrency(c.outstanding) : "—"}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (c) => (
      <Badge variant={c.status === "active" ? "success" : "default"}>
        {c.status === "active" ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    hideOnMobile: true,
    render: (c) => (
      <span className="text-xs text-muted">
        {new Date(c.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </span>
    ),
  },
]

interface CustomerTableProps {
  data: CustomerListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (page: number) => void
  toolbarActions?: React.ReactNode
  onRowClick?: (customer: Customer) => void
}

export default function CustomerTable({
  data,
  loading,
  search,
  onSearch,
  page,
  onPageChange,
  toolbarActions,
  onRowClick,
}: CustomerTableProps) {
  return (
    <div className="space-y-6">
      {data && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Users size={16} />
          <span>
            <strong className="text-heading">{data.total}</strong> total customers
          </span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(c) => c.id}
        searchable
        searchPlaceholder="Search customers..."
        searchQuery={search}
        onSearch={(q) => { onSearch(q); onPageChange(1) }}
        loading={loading}
        page={page}
        total={data?.total}
        pageSize={10}
        onPageChange={onPageChange}
        toolbarActions={toolbarActions}
        onRowClick={onRowClick}
      />
    </div>
  )
}
