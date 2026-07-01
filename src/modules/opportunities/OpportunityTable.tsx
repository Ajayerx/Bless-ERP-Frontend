"use client"
import { Badge } from "@/components/ui"
import DataTable, { type Column } from "@/components/ui/DataTable"
import type { Opportunity } from "@/services/opportunities.service"

interface Props {
  data: { items: Opportunity[]; total: number } | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (p: number) => void
  onRowClick?: (item: Opportunity) => void
}

const stageMap: Record<string, { label: string; variant: "warning" | "info" | "danger" | "success" | "muted" }> = {
  qualification: { label: "Qualification", variant: "warning" },
  proposal: { label: "Proposal", variant: "info" },
  negotiation: { label: "Negotiation", variant: "danger" },
  closed_won: { label: "Closed Won", variant: "success" },
  closed_lost: { label: "Closed Lost", variant: "muted" },
}

const columns: Column<Opportunity>[] = [
  { key: "title", header: "Title", sortable: true },
  { key: "customerName", header: "Customer", sortable: true },
  { key: "value", header: "Value", render: (o) => `$${o.value.toLocaleString()}` },
  {
    key: "stage",
    header: "Stage",
    render: (o) => {
      const s = stageMap[o.stage] ?? { label: o.stage, variant: "muted" as const }
      return <Badge variant={s.variant}>{s.label}</Badge>
    },
  },
  { key: "probability", header: "Prob.", render: (o) => `${o.probability}%` },
  { key: "expectedClose", header: "Expected Close" },
  { key: "assignedTo", header: "Assigned To" },
]

export default function OpportunityTable({ data, loading, search, onSearch, page, onPageChange, onRowClick }: Props) {
  return (
    <DataTable<Opportunity>
      columns={columns}
      data={data?.items ?? []}
      keyExtractor={(o) => o.id}
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
