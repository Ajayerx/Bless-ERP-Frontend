import { useState, useEffect, useCallback } from "react"
import { arrayMove } from "@dnd-kit/sortable"

export type WidgetSize = "full" | "wide" | "normal"

export interface WidgetDefinition {
  id: string
  label: string
  defaultVisible: boolean
  size: WidgetSize
}

export interface WidgetState {
  id: string
  order: number
}

const STORAGE_KEY = "blesserp_dashboard_widgets"

export const AVAILABLE_WIDGETS: WidgetDefinition[] = [
  { id: "kpiCards", label: "KPI Cards", defaultVisible: true, size: "full" },
  { id: "salesChart", label: "Sales Overview Chart", defaultVisible: true, size: "full" },
  { id: "recentInvoices", label: "Recent Invoices", defaultVisible: true, size: "normal" },
  { id: "topCustomers", label: "Top Customers", defaultVisible: true, size: "normal" },
  { id: "inventoryAlerts", label: "Inventory Alerts", defaultVisible: true, size: "normal" },
  { id: "recentPayments", label: "Recent Payments", defaultVisible: true, size: "normal" },
  { id: "pendingOrders", label: "Pending Orders", defaultVisible: true, size: "normal" },
  { id: "lowStock", label: "Low Stock", defaultVisible: true, size: "normal" },
  { id: "customerActivities", label: "Customer Activities", defaultVisible: true, size: "normal" },
  { id: "tasks", label: "Tasks", defaultVisible: false, size: "normal" },
  { id: "calendar", label: "Calendar", defaultVisible: false, size: "normal" },
  { id: "notifications", label: "Notifications", defaultVisible: false, size: "normal" },
  { id: "quickActions", label: "Quick Actions", defaultVisible: true, size: "full" },
]

function getDefaultOrderedWidgets(): WidgetState[] {
  return AVAILABLE_WIDGETS.map((w, i) => ({ id: w.id, order: i }))
}

const KNOWN_WIDGET_IDS = new Set(AVAILABLE_WIDGETS.map((w) => w.id))

function loadWidgetState(): WidgetState[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)

      // Backward compatible: if stored as string[], migrate to ordered list
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
        const migrated: WidgetState[] = parsed
          .filter((id: string) => KNOWN_WIDGET_IDS.has(id))
          .map((id: string, i: number) => ({ id, order: i }))
        // Add any new widgets that weren't in the old list
        const existing = new Set(migrated.map((w) => w.id))
        AVAILABLE_WIDGETS.forEach((w, i) => {
          if (!existing.has(w.id)) {
            migrated.push({ id: w.id, order: migrated.length + i })
          }
        })
        return migrated
      }

      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && "id" in parsed[0]) {
        const migrated = (parsed as WidgetState[])
          .filter((w) => KNOWN_WIDGET_IDS.has(w.id))
          .sort((a, b) => a.order - b.order)
          .map((w, i) => ({ id: w.id, order: i }))
        // Add any new widgets that weren't in the old list
        const existing = new Set(migrated.map((w) => w.id))
        AVAILABLE_WIDGETS.forEach((w, i) => {
          if (!existing.has(w.id)) {
            migrated.push({ id: w.id, order: migrated.length + i })
          }
        })
        return migrated
      }
    }
  } catch {
    // ignore
  }
  return getDefaultOrderedWidgets()
}

function saveWidgetState(state: WidgetState[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function clearWidgetState() {
  localStorage.removeItem(STORAGE_KEY)
}

export function useDashboardWidgets() {
  const [widgets, setWidgets] = useState<WidgetState[]>(loadWidgetState)

  useEffect(() => {
    saveWidgetState(widgets)
  }, [widgets])

  const isVisible = useCallback((id: string) => widgets.some((w) => w.id === id), [widgets])

  const getWidgetSize = useCallback((id: string): WidgetSize => {
    return AVAILABLE_WIDGETS.find((w) => w.id === id)?.size ?? "normal"
  }, [])

  const toggleWidget = useCallback((id: string) => {
    setWidgets((prev) => {
      const exists = prev.some((w) => w.id === id)
      if (exists) {
        return prev.filter((w) => w.id !== id)
      }
      // Add at end
      const maxOrder = prev.reduce((max, w) => Math.max(max, w.order), -1)
      return [...prev, { id, order: maxOrder + 1 }]
    })
  }, [])

  const reorderWidgets = useCallback((fromIndex: number, toIndex: number) => {
    setWidgets((prev) => {
      const visible = [...prev].sort((a, b) => a.order - b.order)
      const reordered = arrayMove(visible, fromIndex, toIndex)
      return reordered.map((w, i) => ({ ...w, order: i }))
    })
  }, [])

  const resetWidgets = useCallback(() => {
    clearWidgetState()
    setWidgets(getDefaultOrderedWidgets())
  }, [])

  const orderedWidgets = [...widgets]
    .filter((w) => KNOWN_WIDGET_IDS.has(w.id))
    .sort((a, b) => a.order - b.order)

  return {
    orderedWidgets,
    isVisible,
    toggleWidget,
    reorderWidgets,
    resetWidgets,
    getWidgetSize,
    availableWidgets: AVAILABLE_WIDGETS,
  }
}
