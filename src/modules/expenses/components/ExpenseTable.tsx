"use client"

import { Wallet, CreditCard, Search } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge } from "@/components/ui"
import { type Expense, type ExpenseListResponse } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

const columns: Column<Expense>[] = [
  {
    key: "description",
    header: "Description",
    render: (e) => (
      <div>
        <p className="font-semibold text-heading">{e.description}</p>
        <p className="text-xs text-muted">{e.supplier}</p>
      </div>
    ),
  },
  {
    key: "category",
    header: "Category",
    render: (e) => <span className="text-xs bg-gray-100 text-muted px-2 py-1 rounded-[6px]">{e.category}</span>,
  },
  {
    key: "amount",
    header: "Amount",
    className: "text-right",
    render: (e) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(e.amount)}</span>,
  },
  {
    key: "date",
    header: "Date",
    hideOnMobile: true,
    render: (e) => <span className="text-sm text-muted">{formatDate(e.date)}</span>,
  },
  {
    key: "paymentMethod",
    header: "Method",
    hideOnMobile: true,
    render: (e) => {
      const icons: Record<string, React.ReactNode> = {
        credit_card: <CreditCard size={13} />,
        bank_transfer: <Wallet size={13} />,
        check: <Search size={13} />,
      }
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted">
          {icons[e.paymentMethod]}
          {e.paymentMethod === "credit_card" ? "Card" : e.paymentMethod === "bank_transfer" ? "Transfer" : e.paymentMethod === "check" ? "Cheque" : e.paymentMethod}
        </span>
      )
    },
  },
  {
    key: "status",
    header: "Status",
    render: (e) => (
      <Badge variant={e.status === "paid" ? "success" : "warning"}>
        {e.status === "paid" ? "Paid" : "Unpaid"}
      </Badge>
    ),
  },
]

interface ExpenseTableProps {
  data: ExpenseListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (page: number) => void
  onRowClick?: (expense: Expense) => void
}

export default function ExpenseTable({
  data, loading, search, onSearch, page, onPageChange, onRowClick,
}: ExpenseTableProps) {
  const totalAmount = data?.items?.reduce((s, e) => s + e.amount, 0) ?? 0
  const unpaidAmount = data?.items?.filter((e) => e.status === "unpaid")?.reduce((s, e) => s + e.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Expenses</p>
            <p className="text-2xl font-bold text-heading mt-1.5 tabular-nums">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-muted mt-0.5">{data?.total ?? 0} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Unpaid</p>
            <p className="text-2xl font-bold text-warning-600 mt-1.5 tabular-nums">{formatCurrency(unpaidAmount)}</p>
            <p className="text-xs text-muted mt-0.5">Awaiting payment</p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(e) => e.id}
        searchable searchPlaceholder="Search expenses..."
        searchQuery={search}
        onSearch={(q) => { onSearch(q); onPageChange(1) }}
        loading={loading}
        page={page}
        total={data?.total}
        pageSize={10}
        onPageChange={onPageChange}
        onRowClick={onRowClick}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-4">
            <Wallet size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No expenses found</p>
            <p className="text-xs text-muted">Record your first expense to get started.</p>
          </div>
        }
      />
    </div>
  )
}
