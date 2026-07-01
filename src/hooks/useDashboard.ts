import { useEffect, useState } from "react"
import { dashboardService, type DashboardData } from "@/services"

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetch = () => {
      setLoading(true)
      dashboardService
        .get()
        .then((d) => { if (!cancelled) setData(d) })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false) })
    }

    fetch()

    const onVisibility = () => {
      if (document.visibilityState === "visible") fetch()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return { data, loading }
}
