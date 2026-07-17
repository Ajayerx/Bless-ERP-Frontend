import { Package, ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import DashboardListCard from "./DashboardListCard"
import type { LowStockItem } from "@/services"

interface Props {
  data?: LowStockItem[]
  loading?: boolean
}

export default function LowStockWidget({ data = [], loading }: Props) {
  const navigate = useNavigate()

  return (
    <DashboardListCard
      title="Low Stock"
      headerRight={
        <button
          onClick={() => navigate("/products")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      }
      loading={loading}
      emptyMessage={!loading && data.length === 0 ? "All stock levels are healthy" : undefined}
    >
      {data.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <div className="w-9 h-9 rounded-[8px] bg-red-100 flex items-center justify-center shrink-0">
            <Package size={16} className="text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-heading">{item.productName}</p>
            <p className="text-xs text-muted">Stock: {item.stock} / Reorder: {item.reorderLevel}</p>
          </div>
          <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700 shrink-0">
            {item.stock} left
          </span>
        </div>
      ))}
    </DashboardListCard>
  )
}
