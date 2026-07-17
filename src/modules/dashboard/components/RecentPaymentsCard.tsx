import { FileText, ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { formatCurrency } from "@/lib/utils"
import DashboardListCard from "./DashboardListCard"
import type { RecentPayment } from "@/services"

interface Props {
  data: RecentPayment[]
}

export default function RecentPaymentsCard({ data }: Props) {
  const navigate = useNavigate()

  return (
    <DashboardListCard
      title="Recent Payments"
      headerRight={
        <button
          onClick={() => navigate("/payments")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      }
      emptyMessage={data.length === 0 ? "No recent payments" : undefined}
    >
      {data.map((pay) => (
        <div
          key={pay.id}
          className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-[8px] bg-gray-50 text-gray-400 flex items-center justify-center shrink-0">
            <FileText size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-heading">
              {pay.number}
            </p>
            <p className="text-xs text-muted">{pay.customerName} · {pay.date}</p>
          </div>
          <span className="text-sm font-semibold text-success-600 tabular-nums">
            {formatCurrency(pay.amount)}
          </span>
        </div>
      ))}
    </DashboardListCard>
  )
}
