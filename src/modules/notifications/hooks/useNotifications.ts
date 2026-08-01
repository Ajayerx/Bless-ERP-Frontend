import { useNotificationContext } from "../context/NotificationContext"
import type { NotificationItem } from "@/services"

export interface UseNotificationsResult {
  notifications: NotificationItem[]
  unreadCount: number
  loading: boolean
  markAsRead: (name: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refetch: () => Promise<void>
}

export function useNotifications(_options?: { pollInterval?: number }): UseNotificationsResult {
  return useNotificationContext()
}
