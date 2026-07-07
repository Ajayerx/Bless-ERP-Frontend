import { DollarSign, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { formatCurrency } from "@/lib/utils"

export default function TodaySalesWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Sales</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[10px] bg-blue-100 flex items-center justify-center">
            <DollarSign size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-heading">{formatCurrency(2840)}</p>
            <div className="flex items-center gap-1 text-xs text-success-600 font-semibold">
              <TrendingUp size={12} />
              +12.5% vs yesterday
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
