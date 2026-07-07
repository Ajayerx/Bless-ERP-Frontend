import { useState, useEffect } from "react"

export interface WidgetDefinition {
  id: string
  label: string
  defaultVisible: boolean
}

const STORAGE_KEY = "blesserp_dashboard_widgets"

export const AVAILABLE_WIDGETS: WidgetDefinition[] = [
  { id: "kpiCards", label: "KPI Cards", defaultVisible: true },
  { id: "todaySales", label: "Today's Sales", defaultVisible: true },
  { id: "pendingOrders", label: "Pending Orders", defaultVisible: true },
  { id: "lowStock", label: "Low Stock", defaultVisible: true },
  { id: "tasks", label: "Tasks", defaultVisible: false },
  { id: "calendar", label: "Calendar", defaultVisible: false },
  { id: "notifications", label: "Notifications", defaultVisible: false },
  { id: "customerActivities", label: "Customer Activities", defaultVisible: true },
  { id: "salesChart", label: "Sales Overview Chart", defaultVisible: true },
  { id: "recentInvoices", label: "Recent Invoices", defaultVisible: true },
  { id: "topCustomers", label: "Top Customers", defaultVisible: true },
  { id: "inventoryAlerts", label: "Inventory Alerts", defaultVisible: true },
  { id: "recentPayments", label: "Recent Payments", defaultVisible: true },
  { id: "quickActions", label: "Quick Actions", defaultVisible: true },
]

function loadWidgetVisibility(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignore
  }
  return AVAILABLE_WIDGETS.filter((w) => w.defaultVisible).map((w) => w.id)
}

export function useDashboardWidgets() {
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(loadWidgetVisibility)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleWidgets))
  }, [visibleWidgets])

  const isVisible = (id: string) => visibleWidgets.includes(id)

  const toggleWidget = (id: string) => {
    setVisibleWidgets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id],
    )
  }

  return { visibleWidgets, isVisible, toggleWidget, availableWidgets: AVAILABLE_WIDGETS }
}
