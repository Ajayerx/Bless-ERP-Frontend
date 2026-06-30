"use client"
import type { ContactListResponse } from "@/services/contacts.service"
import DataTable from "@/components/ui/DataTable"
import { Badge } from "@/components/ui"

interface Props {
  data: ContactListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (p: number) => void
  onRowClick?: (id: string) => void
}

const statusMap: Record<string, { label: string; variant: "success" | "info" | "muted" }> = {
  true: { label: "Primary", variant: "success" },
  false: { label: "Secondary", variant: "muted" },
}

const columns = [
  { key: "name", label: "Name", sortable: true },
  { key: "email", label: "Email", sortable: true },
  { key: "phone", label: "Phone" },
  { key: "role", label: "Role" },
  {
    key: "isPrimary",
    label: "Status",
    render: (v: boolean) => {
      const s = statusMap[String(v)]
      return <Badge variant={s.variant}>{s.label}</Badge>
    },
  },
]

export default function ContactTable({ data, loading, search, onSearch, page, onPageChange, onRowClick }: Props) {
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
