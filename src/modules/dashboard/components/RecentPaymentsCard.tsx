import { FileText, ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { formatCurrency } from "@/lib/utils"
import type { RecentPayment } from "@/services"

interface Props {
  data: RecentPayment[]
}

export default function RecentPaymentsCard({ data }: Props) {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Payments</CardTitle>
        <button
          onClick={() => navigate("/payments")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {data.map((pay) => (
            <div
              key={pay.id}
              className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-[10px] bg-gray-50 text-gray-400 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-heading">
                  {pay.number}
                </p>
                <p className="text-xs text-muted">{pay.date}</p>
                <p className="text-xs text-muted">{pay.customerName}</p>
              </div>
              <span className="text-sm font-semibold text-success-600 tabular-nums">
                {formatCurrency(pay.amount)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
