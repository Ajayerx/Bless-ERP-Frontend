import { useState } from "react"
import { motion } from "framer-motion"
import { CheckCheck, Loader2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useNotifications } from "../hooks/useNotifications"
import { timeAgo, type NotificationItem } from "@/services"
import { sanitizeHtml } from "@/lib/utils"

const dotColors: Record<string, string> = {
  Success: "bg-green-500",
  Info: "bg-blue-500",
  Warning: "bg-amber-500",
  Danger: "bg-red-500",
}

const typeFilters = [
  { label: "All", value: undefined },
  { label: "Info", value: "Info" },
  { label: "Warning", value: "Warning" },
  { label: "Danger", value: "Danger" },
  { label: "Success", value: "Success" },
] as const

export default function Notifications() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications()
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all")
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)

  const filtered = notifications.filter((n) => {
    if (statusFilter === "unread" && n.read) return false
    if (statusFilter === "read" && !n.read) return false
    if (typeFilter && n.type !== typeFilter) return false
    return true
  })

  const handleClick = async (n: NotificationItem) => {
    if (!n.read) {
      await markAsRead(n.name)
    }
  }

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Notifications</h1>
            <p className="text-sm text-muted mt-1">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCheck size={16} />
              Mark all read
            </Button>
          )}
        </div>

        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "unread" | "read")}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="read">Read</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {typeFilters.map((tf) => (
            <button
              key={tf.label}
              onClick={() => setTypeFilter(tf.value)}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors ${
                typeFilter === tf.value
                  ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200"
                  : "bg-gray-100 text-muted hover:bg-gray-200"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="bg-surface rounded-[16px] border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted">
                {statusFilter === "unread"
                  ? "No unread notifications"
                  : statusFilter === "read"
                    ? "No read notifications"
                    : "No notifications"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((n) => (
                <button
                  key={n.name}
                  onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left ${!n.read ? "bg-blue-50/50" : ""}`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${dotColors[n.type] ?? "bg-blue-500"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-body leading-snug" dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.subject) }} />
                    <p className="text-xs text-muted mt-0.5">{timeAgo(n.creation)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
