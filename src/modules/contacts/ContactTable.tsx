"use client"
import type { Contact } from "@/services/contacts.service"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge } from "@/components/ui"

interface Props {
  data: { items: Contact[]; total: number } | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (p: number) => void
  onRowClick?: (item: Contact) => void
}

const statusMap: Record<string, { label: string; variant: "success" | "info" | "muted" }> = {
  true: { label: "Primary", variant: "success" },
  false: { label: "Secondary", variant: "muted" },
}

const columns: Column<Contact>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "email", header: "Email", sortable: true },
  { key: "phone", header: "Phone" },
  { key: "role", header: "Role" },
  {
    key: "isPrimary",
    header: "Status",
    render: (c) => {
      const s = statusMap[String(c.isPrimary)]
      return <Badge variant={s.variant}>{s.label}</Badge>
    },
  },
]

export default function ContactTable({ data, loading, search, onSearch, page, onPageChange, onRowClick }: Props) {
  return (
    <DataTable<Contact>
      columns={columns}
      data={data?.items ?? []}
      keyExtractor={(c) => c.id}
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
