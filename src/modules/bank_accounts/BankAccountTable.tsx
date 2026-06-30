"use client"
import { Badge } from "@/components/ui"
import DataTable from "@/components/ui/DataTable"
import type { BankAccountListResponse } from "@/services/bank_accounts.service"

interface Props {
  data: BankAccountListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (p: number) => void
  onRowClick?: (id: string) => void
}

const typeMap: Record<string, { label: string; variant: "info" | "success" | "warning" }> = {
  chequing: { label: "Chequing", variant: "info" },
  savings: { label: "Savings", variant: "success" },
  credit: { label: "Credit", variant: "warning" },
}

const columns = [
  { key: "name", label: "Account Name", sortable: true },
  { key: "accountNumber", label: "Account #" },
  { key: "type", label: "Type", render: (v: string) => {
    const s = typeMap[v] ?? { label: v, variant: "info" as const }
    return <Badge variant={s.variant}>{s.label}</Badge>
  }},
  { key: "balance", label: "Balance", render: (v: number) => `$${v.toLocaleString()}` },
  { key: "currency", label: "Currency" },
  { key: "institution", label: "Institution" },
  {
    key: "isDefault",
    label: "Default",
    render: (v: boolean) => v ? <Badge variant="success">Yes</Badge> : null,
  },
]

export default function BankAccountTable({ data, loading, search, onSearch, page, onPageChange, onRowClick }: Props) {
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
