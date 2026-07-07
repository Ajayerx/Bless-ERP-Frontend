import { Users, ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

const activities = [
  { id: "a1", customer: "Maple Store", action: "placed order", target: "SO-005", amount: 450 },
  { id: "a2", customer: "Quick Mart", action: "made payment", target: "PAY-006", amount: 180 },
  { id: "a3", customer: "Fresh Choice", action: "created invoice", target: "INV-025", amount: 610 },
  { id: "a4", customer: "Corner Shop", action: "updated profile", target: "", amount: 0 },
]

export default function CustomerActivitiesWidget() {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Activities</CardTitle>
        <button
          onClick={() => navigate("/customers")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {activities.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-[8px] bg-purple-100 flex items-center justify-center shrink-0">
                <Users size={16} className="text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-body">
                  <span className="font-semibold text-heading">{a.customer}</span> {a.action}
                  {a.target && (
                    <>
                      {" "}
                      <span className="font-mono text-primary-600">{a.target}</span>
                    </>
                  )}
                </p>
                {a.amount > 0 && (
                  <p className="text-xs text-muted mt-0.5">${a.amount.toFixed(2)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
