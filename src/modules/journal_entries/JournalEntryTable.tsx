"use client"
import { Badge } from "@/components/ui"
import DataTable from "@/components/ui/DataTable"
import type { JournalEntryListResponse } from "@/services/journal_entries.service"

interface Props {
  data: JournalEntryListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (p: number) => void
  onRowClick?: (id: string) => void
}

const statusMap: Record<string, { label: string; variant: "warning" | "success" }> = {
  draft: { label: "Draft", variant: "warning" },
  posted: { label: "Posted", variant: "success" },
}

const columns = [
  { key: "number", label: "Entry #", sortable: true },
  { key: "date", label: "Date", sortable: true },
  { key: "description", label: "Description" },
  { key: "account", label: "Account" },
  { key: "debit", label: "Debit", render: (v: number) => v ? `$${v.toLocaleString()}` : "-" },
  { key: "credit", label: "Credit", render: (v: number) => v ? `$${v.toLocaleString()}` : "-" },
  {
    key: "status",
    label: "Status",
    render: (v: string) => {
      const s = statusMap[v] ?? { label: v, variant: "muted" as const }
      return <Badge variant={s.variant}>{s.label}</Badge>
    },
  },
]

export default function JournalEntryTable({ data, loading, search, onSearch, page, onPageChange, onRowClick }: Props) {
  return (
    <DataTable
      columns={columns}
      data={data?.items ?? []}
      total={data?.total ?? 0}
      loading={loading}
      search={search}
      onSearch={onSearch}
      page={page}
      pageSize={10}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
    />
  )
}
