import { Bell, ArrowRight, CheckCheck, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { useNotifications } from "../hooks/useNotifications"
import { timeAgo, type NotificationItem } from "@/services"
import { sanitizeHtml } from "@/lib/utils"

const dotColors: Record<string, string> = {
  Success: "bg-green-500",
  Info: "bg-blue-500",
  Warning: "bg-amber-500",
  Danger: "bg-red-500",
}

export default function NotificationDropdown() {
  const navigate = useNavigate()
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications()

  const handleClick = async (n: NotificationItem) => {
    if (!n.read) {
      await markAsRead(n.name)
    }
    navigate("/notifications")
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="p-2.5 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors relative">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-danger-500 text-white text-[10px] font-bold px-1 ring-2 ring-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h4 className="text-sm font-semibold text-heading">Notifications</h4>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-muted" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted">No notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.name}
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${!n.read ? "bg-blue-50/50" : ""}`}
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColors[n.type] ?? "bg-blue-500"}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-body leading-snug" dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.subject) }} />
                  <p className="text-xs text-muted mt-0.5">{timeAgo(n.creation)}</p>
                </div>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-border">
          <button
            onClick={() => navigate("/notifications")}
            className="w-full text-center text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center justify-center gap-1"
          >
            View All Notifications <ArrowRight size={12} />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
