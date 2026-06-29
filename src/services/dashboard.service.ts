import { apiClient } from "./api-client"

export interface KpiMetric {
  label: string
  value: number
  currency?: string
  trend: number
  trendDirection: "up" | "down" | "neutral"
}

export interface SalesMonth {
  month: string
  revenue: number
  orders: number
}

export interface ActivityItem {
  id: string
  type: string
  message: string
  timestamp: string
}

export interface TopCustomer {
  name: string
  revenue: number
}

export interface InventoryAlert {
  name: string
  sku: string
  stock: number
  threshold: number
}

export interface DashboardData {
  kpis: {
    totalRevenue: KpiMetric
    outstandingInvoices: KpiMetric
    lowStockProducts: KpiMetric
    totalCustomers: KpiMetric
    inventoryValue: KpiMetric
    cashFlow: KpiMetric
  }
  salesOverTime: SalesMonth[]
  topCustomers: TopCustomer[]
  inventoryAlerts: InventoryAlert[]
  recentActivity: ActivityItem[]
}

export const dashboardService = {
  async get(): Promise<DashboardData> {
    return apiClient<DashboardData>("/dashboard")
  },
}
