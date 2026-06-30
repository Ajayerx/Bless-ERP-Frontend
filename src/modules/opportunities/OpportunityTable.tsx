"use client"
import { Badge } from "@/components/ui"
import DataTable from "@/components/ui/DataTable"
import type { OpportunityListResponse } from "@/services/opportunities.service"

interface Props {
  data: OpportunityListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (p: number) => void
  onRowClick?: (id: string) => void
}

const stageMap: Record<string, { label: string; variant: "warning" | "info" | "danger" | "success" | "muted" }> = {
  qualification: { label: "Qualification", variant: "warning" },
  proposal: { label: "Proposal", variant: "info" },
  negotiation: { label: "Negotiation", variant: "danger" },
  closed_won: { label: "Closed Won", variant: "success" },
  closed_lost: { label: "Closed Lost", variant: "muted" },
}

const columns = [
  { key: "title", label: "Title", sortable: true },
  { key: "customerName", label: "Customer", sortable: true },
  { key: "value", label: "Value", render: (v: number) => `$${v.toLocaleString()}` },
  {
    key: "stage",
    label: "Stage",
    render: (v: string) => {
      const s = stageMap[v] ?? { label: v, variant: "muted" as const }
      return <Badge variant={s.variant}>{s.label}</Badge>
    },
  },
  { key: "probability", label: "Prob.", render: (v: number) => `${v}%` },
  { key: "expectedClose", label: "Expected Close" },
  { key: "assignedTo", label: "Assigned To" },
]

export default function OpportunityTable({ data, loading, search, onSearch, page, onPageChange, onRowClick }: Props) {
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
