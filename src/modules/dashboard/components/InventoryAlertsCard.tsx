import { ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import DashboardListCard from "./DashboardListCard"
import type { InventoryAlert } from "@/services"

interface Props {
  data: InventoryAlert[]
}

const statusConfig: Record<string, { label: string; badge: string }> = {
  out_of_stock: { label: "Out of Stock", badge: "bg-danger-200 text-danger-800" },
  negative_stock: { label: "Negative Stock", badge: "bg-danger-100 text-danger-700" },
  low_stock: { label: "Low Stock", badge: "bg-warning-100 text-warning-700" },
  overstock: { label: "Overstock", badge: "bg-info-100 text-info-700" },
  expiring: { label: "Expiring", badge: "bg-purple-100 text-purple-700" },
  pending_purchase: { label: "Pending Purchase", badge: "bg-warning-200 text-warning-800" },
  reorder_soon: { label: "Reorder Soon", badge: "bg-warning-100 text-warning-700" },
}

export default function InventoryAlertsCard({ data }: Props) {
  const navigate = useNavigate()
  const visible = data.slice(0, 5)

  return (
    <DashboardListCard
      title="Inventory Alerts"
      headerRight={
        <button
          onClick={() => navigate("/products")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      }
      emptyMessage={visible.length === 0 ? "No inventory alerts" : undefined}
    >
      {visible.map((item) => {
        const cfg = statusConfig[item.status]
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors"
          >
            <div
              className="w-9 h-9 rounded-[8px] shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-heading">
                {item.productName}
              </p>
              <p className="text-xs text-muted">
                Stock: {item.stock} / Reorder: {item.reorderLevel}
              </p>
            </div>
            <span
              className={"inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full shrink-0 " + (cfg?.badge ?? "")}
            >
              {cfg?.label}
            </span>
          </div>
        )
      })}
    </DashboardListCard>
  )
}
