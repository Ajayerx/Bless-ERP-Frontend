import { Bell, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

const notifications = [
  { id: "n1", text: "Invoice INV-024 has been paid", time: "5 min ago", type: "success" },
  { id: "n2", text: "New customer registered: City Mart", time: "1 hour ago", type: "info" },
  { id: "n3", text: "Stock alert: Peach Rings out of stock", time: "2 hours ago", type: "warning" },
  { id: "n4", text: "Purchase order PO-023 is overdue", time: "1 day ago", type: "danger" },
]

const typeStyles: Record<string, string> = {
  success: "bg-green-100 text-green-600",
  info: "bg-blue-100 text-blue-600",
  warning: "bg-amber-100 text-amber-600",
  danger: "bg-red-100 text-red-600",
}

export default function NotificationsWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <button className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1">
          View All <ArrowRight size={12} />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-3 px-6 py-3 hover:bg-gray-50 transition-colors"
            >
              <div
                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  n.type === "success"
                    ? "bg-green-500"
                    : n.type === "warning"
                      ? "bg-amber-500"
                      : n.type === "danger"
                        ? "bg-red-500"
                        : "bg-blue-500"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-body">{n.text}</p>
                <p className="text-xs text-muted mt-0.5">{n.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
