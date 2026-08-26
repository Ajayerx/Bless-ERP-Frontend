import { FileText, ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import DashboardListCard from "./DashboardListCard"
import type { RecentInvoice } from "@/services"

interface Props {
  data: RecentInvoice[]
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  paid: { bg: "bg-success-100", text: "text-success-700", label: "Paid" },
  partial: { bg: "bg-warning-100", text: "text-warning-700", label: "Partial" },
  unpaid: { bg: "bg-danger-100", text: "text-danger-700", label: "Unpaid" },
}

function compactMoney(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) {
    const m = v / 1_000_000
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (abs >= 1_000) {
    const k = v / 1_000
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`
  }
  return `$${v.toFixed(2)}`
}

export default function RecentInvoicesCard({ data }: Props) {
  const navigate = useNavigate()

  return (
    <DashboardListCard
      title="Recent Invoices"
      className="h-[380px]"
      scrollable
      headerRight={
        <button
          onClick={() => navigate("/invoices")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      }
      emptyMessage={data.length === 0 ? "No recent invoices" : undefined}
    >
      {data.map((inv) => {
        const style = statusStyles[inv.status] ?? statusStyles.unpaid
        return (
          <div
            key={inv.id}
            onClick={() => navigate(`/invoices/${inv.id}`)}
            className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-[8px] bg-gray-50 text-gray-400 flex items-center justify-center shrink-0">
              <FileText size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-heading whitespace-nowrap truncate">
                {inv.number}
              </p>
              <p className="text-xs text-muted">{inv.customerName} · {inv.date}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-semibold text-heading tabular-nums whitespace-nowrap">
                {compactMoney(inv.amount)}
              </span>
              <span
                className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full ${style.bg} ${style.text}`}
              >
                {style.label}
              </span>
            </div>
          </div>
        )
      })}
    </DashboardListCard>
  )
}
