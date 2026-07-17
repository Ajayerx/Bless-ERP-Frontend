import { apiClient } from "@/services/api-client"

export interface NotificationItem {
  name: string
  subject: string
  type: "Info" | "Warning" | "Danger" | "Success"
  creation: string
  read: number
  from_user: string
}

function buildListUrl(params: {
  fields: string[]
  filters?: unknown[]
  limit_page_length?: number
  order_by?: string
}): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/Notification Log?${qp.toString()}`
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
  return date.toLocaleDateString()
}

export const notificationService = {
  async getRecent(limit = 10): Promise<NotificationItem[]> {
    return apiClient<NotificationItem[]>(
      buildListUrl({
        fields: ["name", "subject", "type", "creation", "read", "from_user"],
        order_by: "creation desc",
        limit_page_length: limit,
      })
    )
  },

  async getUnreadCount(): Promise<number> {
    const data = await apiClient<NotificationItem[]>(
      buildListUrl({
        fields: ["name"],
        filters: [["read", "=", 0]],
        limit_page_length: 0,
      })
    )
    return Array.isArray(data) ? data.length : 0
  },

  async getFiltered(type?: string, read?: number, page = 1, limit = 20): Promise<NotificationItem[]> {
    const filters: unknown[] = []
    if (type) filters.push(["type", "=", type])
    if (read !== undefined) filters.push(["read", "=", read])
    return apiClient<NotificationItem[]>(
      buildListUrl({
        fields: ["name", "subject", "type", "creation", "read", "from_user"],
        filters: filters.length > 0 ? filters : undefined,
        order_by: "creation desc",
        limit_page_length: limit,
      })
    )
  },

  async markAsRead(name: string): Promise<void> {
    await apiClient(`/resource/Notification Log/${name}`, {
      method: "PUT",
      body: { read: 1 },
    })
  },

  async markAllAsRead(): Promise<void> {
    const unread = await apiClient<NotificationItem[]>(
      buildListUrl({
        fields: ["name"],
        filters: [["read", "=", 0]],
        limit_page_length: 0,
      })
    )
    if (!Array.isArray(unread) || unread.length === 0) return
    await Promise.all(
      unread.map((n) =>
        apiClient(`/resource/Notification Log/${n.name}`, {
          method: "PUT",
          body: { read: 1 },
        })
      )
    )
  },
}

export { timeAgo }
