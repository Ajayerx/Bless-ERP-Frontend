import { Users, ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { formatCurrency } from "@/lib/utils"
import DashboardListCard from "./DashboardListCard"
import type { CustomerActivity } from "@/services"

interface Props {
  data?: CustomerActivity[]
  loading?: boolean
}

const actionColors: Record<string, string> = {
  "created invoice": "bg-blue-100 text-blue-600",
  "made payment": "bg-green-100 text-green-600",
  "placed order": "bg-amber-100 text-amber-600",
}

export default function CustomerActivitiesWidget({ data = [], loading }: Props) {
  const navigate = useNavigate()

  return (
    <DashboardListCard
      title="Customer Activities"
      headerRight={
        <button
          onClick={() => navigate("/customers")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      }
      loading={loading}
      emptyMessage={!loading && data.length === 0 ? "No recent activities" : undefined}
    >
      {data.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 ${actionColors[a.action] ?? "bg-purple-100 text-purple-600"}`}>
            <Users size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-body">
              <span className="font-semibold text-heading">{a.customer}</span> {a.action}
              {a.target && (
                <>
                  {" "}
                  <span className="font-mono text-primary-600">{a.target}</span>
                </>
              )}
            </p>
            {a.amount > 0 && (
              <p className="text-xs text-muted mt-0.5">{formatCurrency(a.amount)}</p>
            )}
          </div>
        </div>
      ))}
    </DashboardListCard>
  )
}
