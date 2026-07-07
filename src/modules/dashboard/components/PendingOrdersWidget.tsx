import { ShoppingBag, ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

const pendingOrders = [
  { id: "SO-001", customer: "Maple Store", amount: 450, items: 3 },
  { id: "SO-002", customer: "Quick Mart", amount: 280, items: 2 },
  { id: "SO-003", customer: "Fresh Choice", amount: 610, items: 5 },
]

export default function PendingOrdersWidget() {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Orders</CardTitle>
        <button
          onClick={() => navigate("/sales-orders")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {pendingOrders.map((order) => (
            <div
              key={order.id}
              className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => navigate(`/sales-orders/${order.id}`)}
            >
              <div className="w-9 h-9 rounded-[8px] bg-amber-100 flex items-center justify-center shrink-0">
                <ShoppingBag size={16} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-heading">{order.customer}</p>
                <p className="text-xs text-muted">{order.items} items · ${order.amount.toFixed(2)}</p>
              </div>
              <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700">
                Pending
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
