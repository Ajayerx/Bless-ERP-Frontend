import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { notificationService, timeAgo, type NotificationItem } from "@/services"
import { sanitizeHtml } from "@/lib/utils"
import DashboardListCard from "./DashboardListCard"

const dotColors: Record<string, string> = {
  Success: "bg-green-500",
  Info: "bg-blue-500",
  Warning: "bg-amber-500",
  Danger: "bg-red-500",
}

export default function NotificationsWidget() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    notificationService
      .getRecent()
      .then((data) => {
        if (!cancelled) setNotifications(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleClick = async (n: NotificationItem) => {
    if (!n.read) {
      await notificationService.markAsRead(n.name)
      setNotifications((prev) => prev.map((item) => (item.name === n.name ? { ...item, read: 1 } : item)))
    }
    navigate("/notifications")
  }

  return (
    <DashboardListCard
      title="Notifications"
      headerRight={
        <button
          onClick={() => navigate("/notifications")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View All <ArrowRight size={12} />
        </button>
      }
      loading={loading}
      emptyMessage={!loading && notifications.length === 0 ? "No notifications" : undefined}
    >
      {notifications.slice(0, 5).map((n) => (
        <button
          key={n.name}
          onClick={() => handleClick(n)}
          className={`w-full flex items-start gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors text-left ${!n.read ? "bg-blue-50/50" : ""}`}
        >
          <div
            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColors[n.type] ?? "bg-blue-500"}`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.subject) }} />
            <p className="text-xs text-muted mt-0.5">{timeAgo(n.creation)}</p>
          </div>
          {!n.read && (
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
          )}
        </button>
      ))}
    </DashboardListCard>
  )
}
