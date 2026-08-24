import { ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { formatCurrency } from "@/lib/utils"
import { Avatar } from "@/components/ui"
import DashboardListCard from "./DashboardListCard"
import type { TopCustomer } from "@/services"

interface Props {
  data: TopCustomer[]
}

export default function TopCustomersCard({ data }: Props) {
  const navigate = useNavigate()

  return (
    <DashboardListCard
      title="Top Customers"
      headerRight={
        <button
          onClick={() => navigate("/customers")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      }
      emptyMessage={data.length === 0 ? "No customer data" : undefined}
    >
      {data.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <Avatar name={c.name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-heading">{c.name}</p>
          </div>
          <span className="text-sm font-semibold text-heading tabular-nums">
            {formatCurrency(c.amount)}
          </span>
        </div>
      ))}
    </DashboardListCard>
  )
}
