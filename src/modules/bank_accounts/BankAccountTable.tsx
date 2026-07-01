"use client"
import { Badge } from "@/components/ui"
import DataTable, { type Column } from "@/components/ui/DataTable"
import type { BankAccount } from "@/services/bank_accounts.service"

interface Props {
  data: { items: BankAccount[]; total: number } | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (p: number) => void
  onRowClick?: (item: BankAccount) => void
}

const typeMap: Record<string, { label: string; variant: "info" | "success" | "warning" }> = {
  chequing: { label: "Chequing", variant: "info" },
  savings: { label: "Savings", variant: "success" },
  credit: { label: "Credit", variant: "warning" },
}

const columns: Column<BankAccount>[] = [
  { key: "name", header: "Account Name", sortable: true },
  { key: "accountNumber", header: "Account #" },
  { key: "type", header: "Type", render: (a) => {
    const s = typeMap[a.type] ?? { label: a.type, variant: "info" as const }
    return <Badge variant={s.variant}>{s.label}</Badge>
  }},
  { key: "balance", header: "Balance", render: (a) => `$${a.balance.toLocaleString()}` },
  { key: "currency", header: "Currency" },
  { key: "institution", header: "Institution" },
  {
    key: "isDefault",
    header: "Default",
    render: (a) => a.isDefault ? <Badge variant="success">Yes</Badge> : null,
  },
]

export default function BankAccountTable({ data, loading, search, onSearch, page, onPageChange, onRowClick }: Props) {
  return (
    <DataTable<BankAccount>
      columns={columns}
      data={data?.items ?? []}
      keyExtractor={(a) => a.id}
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
