import { FileText, ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { formatCurrency } from "@/lib/utils"
import DashboardListCard from "./DashboardListCard"
import type { RecentInvoice } from "@/services"

interface Props {
  data: RecentInvoice[]
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
  partial: { bg: "bg-amber-100", text: "text-amber-700", label: "Partial" },
  unpaid: { bg: "bg-red-100", text: "text-red-700", label: "Unpaid" },
}

export default function RecentInvoicesCard({ data }: Props) {
  const navigate = useNavigate()

  return (
    <DashboardListCard
      title="Recent Invoices"
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
            className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-[8px] bg-gray-50 text-gray-400 flex items-center justify-center shrink-0">
              <FileText size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-heading">
                {inv.number}
              </p>
              <p className="text-xs text-muted">{inv.customerName} · {inv.date}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-sm font-semibold text-heading tabular-nums">
                {formatCurrency(inv.amount)}
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
