import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import type { InventoryAlert } from "@/services"

interface Props {
  data: InventoryAlert[]
}

const statusConfig: Record<string, { label: string; badge: string }> = {
  out_of_stock: { label: "Out of Stock", badge: "bg-red-700 text-white" },
  negative_stock: { label: "Negative Stock", badge: "bg-red-900 text-white" },
  low_stock: { label: "Low Stock", badge: "bg-amber-500 text-white" },
  overstock: { label: "Overstock", badge: "bg-blue-500 text-white" },
  expiring: { label: "Expiring", badge: "bg-purple-500 text-white" },
  pending_purchase: { label: "Pending Purchase", badge: "bg-orange-500 text-white" },
  reorder_soon: { label: "Reorder Soon", badge: "bg-amber-500 text-white" },
}

const INITIAL_SHOW = 4

export default function InventoryAlertsCard({ data }: Props) {
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? data : data.slice(0, INITIAL_SHOW)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Alerts</CardTitle>
        <button
          onClick={() => navigate("/products")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {visible.map((item) => {
            const cfg = statusConfig[item.status]
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-[10px] shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-heading">
                    {item.productName}
                  </p>
                  <p className="text-xs text-muted">
                    Current stock: {item.stock} | Reorder level:{" "}
                    {item.reorderLevel}
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
        </div>

        {data.length > INITIAL_SHOW && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center justify-center gap-1 w-full py-3 text-xs font-semibold text-muted hover:text-body border-t border-border transition-colors"
          >
            {showAll ? (
              <>Show Less <ChevronUp size={14} /></>
            ) : (
              <>Show {data.length - INITIAL_SHOW} More <ChevronDown size={14} /></>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
