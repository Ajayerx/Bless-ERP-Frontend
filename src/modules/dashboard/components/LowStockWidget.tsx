import { Package, ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

const lowStockItems = [
  { name: "Peach Rings (500g)", stock: 3, reorderLevel: 20 },
  { name: "Rainbow Candy (1kg)", stock: 5, reorderLevel: 30 },
  { name: "Mango Candy (500g)", stock: 8, reorderLevel: 25 },
  { name: "Sour Belts (1kg)", stock: 2, reorderLevel: 15 },
]

export default function LowStockWidget() {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Low Stock</CardTitle>
        <button
          onClick={() => navigate("/products")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {lowStockItems.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-[8px] bg-red-100 flex items-center justify-center shrink-0">
                <Package size={16} className="text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-heading">{item.name}</p>
                <p className="text-xs text-muted">Stock: {item.stock} / Reorder: {item.reorderLevel}</p>
              </div>
              <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700 shrink-0">
                {item.stock} left
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
