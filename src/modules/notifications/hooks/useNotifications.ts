import { useCallback, useEffect, useRef, useState } from "react"
import { notificationService, type NotificationItem } from "@/services"

interface UseNotificationsOptions {
  pollInterval?: number
}

export function useNotifications({ pollInterval = 30000 }: UseNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationService.getRecent(10)
      setNotifications(data)
    } catch {
      // silent
    }
  }, [])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount()
      setUnreadCount(count)
    } catch {
      // silent
    }
  }, [])

  const refetch = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchNotifications(), fetchUnreadCount()])
    setLoading(false)
  }, [fetchNotifications, fetchUnreadCount])

  const markAsRead = useCallback(async (name: string) => {
    await notificationService.markAsRead(name)
    setNotifications((prev) => prev.map((n) => (n.name === name ? { ...n, read: 1 } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [])

  const markAllAsRead = useCallback(async () => {
    await notificationService.markAllAsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })))
    setUnreadCount(0)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    if (pollInterval > 0) {
      intervalRef.current = setInterval(fetchUnreadCount, pollInterval)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [pollInterval, fetchUnreadCount])

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch }
}
