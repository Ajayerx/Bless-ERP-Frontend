"use client"

import { Phone, Mail } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge } from "@/components/ui"
import type { Lead } from "@/services"
import { formatCurrency } from "@/lib/utils"

const statusStyles: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" | "purple" }> = {
  new: { label: "New", variant: "info" },
  contacted: { label: "Contacted", variant: "warning" },
  qualified: { label: "Qualified", variant: "purple" },
  proposal: { label: "Proposal", variant: "primary" },
  lost: { label: "Lost", variant: "danger" },
}

const columns: Column<Lead>[] = [
  {
    key: "name",
    header: "Lead",
    render: (l) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-warning-50 text-warning-600 flex items-center justify-center text-sm font-bold">
          {l.firstName[0]}{l.lastName[0]}
        </div>
        <div>
          <p className="font-semibold text-heading">{l.firstName} {l.lastName}</p>
          <p className="text-xs text-muted">{l.company}</p>
        </div>
      </div>
    ),
  },
  {
    key: "contact",
    header: "Contact",
    render: (l) => (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-sm text-muted"><Mail size={12} /> {l.email}</div>
        <div className="flex items-center gap-1.5 text-sm text-muted"><Phone size={12} /> {l.phone}</div>
      </div>
    ),
  },
  {
    key: "source",
    header: "Source",
    render: (l) => <span className="text-xs capitalize bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">{l.source.replace("_", " ")}</span>,
  },
  {
    key: "estimatedValue",
    header: "Value",
    className: "text-right",
    render: (l) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(l.estimatedValue)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (l) => {
      const s = statusStyles[l.status] ?? { label: l.status, variant: "default" as const }
      return <Badge variant={s.variant}>{s.label}</Badge>
    },
  },
]

interface LeadTableProps {
  data: { items: Lead[]; total: number } | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (page: number) => void
  onRowClick?: (lead: Lead) => void
}

export default function LeadTable({
  data, loading, search, onSearch, page, onPageChange, onRowClick,
}: LeadTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data?.items ?? []}
      keyExtractor={(l) => l.id}
      searchable searchPlaceholder="Search leads..."
      searchQuery={search}
      onSearch={(q) => { onSearch(q); onPageChange(1) }}
      loading={loading}
      page={page}
      total={data?.total}
      pageSize={10}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
    />
  )
}
