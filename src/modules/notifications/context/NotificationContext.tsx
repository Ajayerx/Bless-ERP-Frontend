import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { notificationService, type NotificationItem } from "@/services"

const POLL_INTERVAL = 30000

interface NotificationContextValue {
  notifications: NotificationItem[]
  unreadCount: number
  loading: boolean
  markAsRead: (name: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refetch: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

let bootstrapped = false

export function NotificationProvider({ children }: { children: ReactNode }) {
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

  useEffect(() => {
    if (bootstrapped) return
    bootstrapped = true
    refetch()

    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refetch, fetchUnreadCount])

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

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotificationContext() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error("useNotificationContext must be used within NotificationProvider")
  return ctx
}
