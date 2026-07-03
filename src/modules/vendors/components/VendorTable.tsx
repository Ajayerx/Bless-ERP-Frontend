"use client"

import { Mail, Phone } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge, Avatar } from "@/components/ui"
import type { Vendor, VendorListResponse } from "@/services"

const columns: Column<Vendor>[] = [
  {
    key: "name",
    header: "Vendor",
    render: (v) => (
      <div className="flex items-center gap-3">
        <Avatar name={v.name} size="sm" />
        <div>
          <p className="font-semibold text-heading">{v.name}</p>
          <p className="text-xs text-muted">{v.contactName}</p>
        </div>
      </div>
    ),
  },
  {
    key: "email",
    header: "Contact",
    hideOnMobile: true,
    render: (v) => (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs text-muted"><Mail size={12} />{v.email}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted"><Phone size={12} />{v.phone}</div>
      </div>
    ),
  },
  { key: "taxId", header: "Tax ID", hideOnMobile: true, render: (v) => <span className="text-xs text-muted">{v.taxId || "—"}</span> },
  { key: "status", header: "Status", render: (v) => <Badge variant={v.status === "active" ? "success" : "default"}>{v.status === "active" ? "Active" : "Inactive"}</Badge> },
  { key: "createdAt", header: "Created", hideOnMobile: true, render: (v) => <span className="text-xs text-muted">{new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span> },
]

interface VendorTableProps {
  data: VendorListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (page: number) => void
  onRowClick?: (vendor: Vendor) => void
}

export default function VendorTable({ data, loading, search, onSearch, page, onPageChange, onRowClick }: VendorTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data?.items ?? []}
      keyExtractor={(v) => v.id}
      searchable searchPlaceholder="Search vendors..."
      searchQuery={search}
      onSearch={(q) => { onSearch(q); onPageChange(1) }}
      loading={loading} page={page} total={data?.total} pageSize={10} onPageChange={onPageChange}
      onRowClick={onRowClick}
    />
  )
}
