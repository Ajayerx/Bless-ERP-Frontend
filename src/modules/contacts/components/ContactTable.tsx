"use client"
import type { Contact } from "@/services"
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

const columns: Column<Contact>[] = [
  {
    key: "first_name",
    header: "Name",
    sortable: true,
    render: (c) => `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`,
  },
  {
    key: "email_id",
    header: "Email",
    sortable: true,
    render: (c) => c.email_id || "—",
  },
  {
    key: "mobile_no",
    header: "Phone",
    render: (c) => c.mobile_no || c.phone || "—",
  },
  {
    key: "company_name",
    header: "Company",
  },
  {
    key: "is_primary_contact",
    header: "Status",
    render: (c) => (
      <Badge variant={c.is_primary_contact ? "success" : "default"}>
        {c.is_primary_contact ? "Primary" : "Secondary"}
      </Badge>
    ),
  },
]

export default function ContactTable({ data, loading, search, onSearch, page, onPageChange, onRowClick }: Props) {
  return (
    <DataTable<Contact>
      columns={columns}
      data={data?.items ?? []}
      keyExtractor={(c) => c.name}
      total={data?.total ?? 0}
      loading={loading}
      searchQuery={search}
      onSearch={onSearch}
      page={page}
      pageSize={10}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
    />
  )
}
