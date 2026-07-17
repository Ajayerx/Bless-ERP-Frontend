import { useEffect, useState } from "react"
import { ShoppingBag, ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { salesOrderService, type SalesOrder } from "@/services"
import { formatCurrency } from "@/lib/utils"
import DashboardListCard from "./DashboardListCard"

export default function PendingOrdersWidget() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    salesOrderService
      .list({ status: "draft", pageSize: 5 })
      .then((res) => {
        if (!cancelled) setOrders(res.items)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <DashboardListCard
      title="Pending Orders"
      headerRight={
        <button
          onClick={() => navigate("/sales-orders")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      }
      loading={loading}
      emptyMessage={!loading && orders.length === 0 ? "No pending orders" : undefined}
    >
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={() => navigate(`/sales-orders/${order.id}`)}
        >
          <div className="w-9 h-9 rounded-[8px] bg-amber-100 flex items-center justify-center shrink-0">
            <ShoppingBag size={16} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-heading">{order.customerName}</p>
            <p className="text-xs text-muted">{order.items.length} items · {formatCurrency(order.total)}</p>
          </div>
          <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700">
            Pending
          </span>
        </div>
      ))}
    </DashboardListCard>
  )
}
