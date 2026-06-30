import { ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { formatCurrency, cn } from "@/lib/utils"
import type { TopCustomer } from "@/services"

interface Props {
  data: TopCustomer[]
}

export default function TopCustomersCard({ data }: Props) {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Customers</CardTitle>
        <button
          onClick={() => navigate("/customers")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {data.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                  c.color,
                )}
              >
                {c.initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-heading">{c.name}</p>
              </div>
              <span className="text-sm font-semibold text-heading tabular-nums">
                {formatCurrency(c.amount)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
