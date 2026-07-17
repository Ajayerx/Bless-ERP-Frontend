import { useState, useCallback, useEffect } from "react"

export type KpiKey = "totalRevenue" | "accountsReceivable" | "inventoryValue" | "cashFlow" | "todaySales"

export const KPI_DEFINITIONS: { key: KpiKey; label: string }[] = [
  { key: "totalRevenue", label: "Total Revenue" },
  { key: "accountsReceivable", label: "Accounts Receivable" },
  { key: "inventoryValue", label: "Inventory Value" },
  { key: "cashFlow", label: "Cash Flow" },
  { key: "todaySales", label: "Today's Sales" },
]

const STORAGE_KEY = "blesserp_kpi_visibility"

function loadVisibility(): Record<KpiKey, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (typeof parsed === "object" && parsed !== null) {
        const result: Record<KpiKey, boolean> = {
          totalRevenue: true,
          accountsReceivable: true,
          inventoryValue: true,
          cashFlow: true,
          todaySales: true,
        }
        for (const def of KPI_DEFINITIONS) {
          if (def.key in parsed) {
            result[def.key] = Boolean(parsed[def.key])
          }
        }
        return result
      }
    }
  } catch {
    // ignore
  }
  return {
    totalRevenue: true,
    accountsReceivable: true,
    inventoryValue: true,
    cashFlow: true,
    todaySales: true,
  }
}

function saveVisibility(state: Record<KpiKey, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useKpiVisibility() {
  const [visibility, setVisibility] = useState<Record<KpiKey, boolean>>(loadVisibility)

  useEffect(() => {
    saveVisibility(visibility)
  }, [visibility])

  const isKpiVisible = useCallback((key: KpiKey) => visibility[key] ?? true, [visibility])

  const toggleKpi = useCallback((key: KpiKey) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const resetKpis = useCallback(() => {
    const defaults: Record<KpiKey, boolean> = {
      totalRevenue: true,
      accountsReceivable: true,
      inventoryValue: true,
      cashFlow: true,
      todaySales: true,
    }
    setVisibility(defaults)
  }, [])

  const visibleCount = KPI_DEFINITIONS.filter((d) => visibility[d.key]).length

  return { isKpiVisible, toggleKpi, resetKpis, visibleCount }
}
