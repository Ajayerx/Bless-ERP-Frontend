"use client"

import { CheckCircle2, Clock, FileText, DollarSign } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent } from "@/components/ui"
import { type Payment, type PaymentListResponse } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { methodConfig } from "./PaymentMethodSelect"

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
  iconBg,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ElementType
  iconClass: string
  iconBg: string
}) {
  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
      <div className={cn("p-2.5 rounded-[10px] shrink-0", iconBg, iconClass)}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-heading tracking-tight mt-0.5">{value}</p>
        <p className="text-xs text-muted mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

const paymentColumns: Column<Payment>[] = [
  {
    key: "customerName",
    header: "Customer",
    render: (p) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center shrink-0">
          <CheckCircle2 size={15} />
        </div>
        <div>
          <p className="font-semibold text-heading">{p.customerName}</p>
          <p className="text-xs text-muted">{p.invoiceNumber}</p>
        </div>
      </div>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    className: "text-right",
    render: (p) => (
      <span className="font-semibold tabular-nums text-success-600">
        {formatCurrency(p.amount)}
      </span>
    ),
  },
  {
    key: "paymentMethod",
    header: "Method",
    hideOnMobile: true,
    render: (p) => {
      const cfg = methodConfig[p.paymentMethod]
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted">
          {cfg?.icon}
          {cfg?.label ?? p.paymentMethod}
        </span>
      )
    },
  },
  {
    key: "referenceNumber",
    header: "Reference",
    hideOnMobile: true,
    render: (p) => (
      <span className="font-mono text-xs text-muted">
        {p.referenceNumber ?? "—"}
      </span>
    ),
  },
  {
    key: "paymentDate",
    header: "Date",
    render: (p) => (
      <span className="text-sm text-muted">{formatDate(p.paymentDate)}</span>
    ),
  },
]

interface PaymentTableProps {
  paymentsData: PaymentListResponse | null
  loading: boolean
  page: number
  onPageChange: (page: number) => void
  onRowClick?: (payment: Payment) => void
}

export default function PaymentTable({ paymentsData, loading, page, onPageChange, onRowClick }: PaymentTableProps) {
  const totalCollected = paymentsData?.items?.reduce((s, p) => s + p.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard
          label="Collected"
          value={formatCurrency(totalCollected)}
          sub={`${paymentsData?.total ?? 0} payments`}
          icon={CheckCircle2}
          iconClass="text-success-600"
          iconBg="bg-success-50"
        />
        <SummaryCard
          label="Pending"
          value="—"
          sub="Unpaid invoices"
          icon={Clock}
          iconClass="text-warning-600"
          iconBg="bg-warning-50"
        />
        <SummaryCard
          label="Overdue"
          value={0}
          sub="Invoices past due"
          icon={FileText}
          iconClass="text-danger-600"
          iconBg="bg-danger-50"
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-heading">Payment History</h2>
        <DataTable
          columns={paymentColumns}
          data={paymentsData?.items ?? []}
          keyExtractor={(p) => p.id}
          loading={loading}
          page={page}
          total={paymentsData?.total}
          pageSize={10}
          onPageChange={onPageChange}
          onRowClick={onRowClick}
          emptyState={
            <div className="flex flex-col items-center gap-2 py-4">
              <DollarSign size={32} className="text-muted opacity-40" />
              <p className="font-semibold text-body">No payments recorded yet</p>
              <p className="text-xs text-muted">
                Record a payment against an unpaid invoice above.
              </p>
            </div>
          }
        />
      </section>
    </div>
  )
}
