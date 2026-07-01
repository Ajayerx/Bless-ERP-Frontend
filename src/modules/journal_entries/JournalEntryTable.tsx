"use client"
import { Badge } from "@/components/ui"
import DataTable, { type Column } from "@/components/ui/DataTable"
import type { JournalEntry } from "@/services/journal_entries.service"

interface Props {
  data: { items: JournalEntry[]; total: number } | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (p: number) => void
  onRowClick?: (item: JournalEntry) => void
}

const statusMap: Record<string, { label: string; variant: "warning" | "success" }> = {
  draft: { label: "Draft", variant: "warning" },
  posted: { label: "Posted", variant: "success" },
}

const columns: Column<JournalEntry>[] = [
  { key: "number", header: "Entry #", sortable: true },
  { key: "date", header: "Date", sortable: true },
  { key: "description", header: "Description" },
  { key: "account", header: "Account" },
  { key: "debit", header: "Debit", render: (j) => j.debit ? `$${j.debit.toLocaleString()}` : "-" },
  { key: "credit", header: "Credit", render: (j) => j.credit ? `$${j.credit.toLocaleString()}` : "-" },
  {
    key: "status",
    header: "Status",
    render: (j) => {
      const s = statusMap[j.status] ?? { label: j.status, variant: "warning" as const }
      return <Badge variant={s.variant}>{s.label}</Badge>
    },
  },
]

export default function JournalEntryTable({ data, loading, search, onSearch, page, onPageChange, onRowClick }: Props) {
  return (
    <DataTable<JournalEntry>
      columns={columns}
      data={data?.items ?? []}
      keyExtractor={(j) => j.id}
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
