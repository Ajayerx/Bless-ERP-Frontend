import { apiClient } from "./api-client"

export interface KpiMetric {
  label: string
  value: number
  currency?: string
  trend: number
  trendDirection: "up" | "down" | "neutral"
  sparkline: number[]
}

export interface SalesDay {
  date: string
  value: number
}

export interface RecentInvoice {
  id: string
  number: string
  date: string
  customerName: string
  amount: number
  status: "paid" | "partial" | "unpaid"
}

export interface TopCustomer {
  id: string
  name: string
  amount: number
  initial: string
  color: string
}

export interface InventoryAlert {
  id: string
  productName: string
  stock: number
  reorderLevel: number
  status: "low_stock" | "reorder_soon"
  color: string
}

export interface RecentPayment {
  id: string
  number: string
  date: string
  customerName: string
  amount: number
}

export interface DashboardData {
  kpis: {
    totalRevenue: KpiMetric
    accountsReceivable: KpiMetric
    inventoryValue: KpiMetric
    cashFlow: KpiMetric
  }
  salesChart: SalesDay[]
  recentInvoices: RecentInvoice[]
  topCustomers: TopCustomer[]
  inventoryAlerts: InventoryAlert[]
  recentPayments: RecentPayment[]
}

export const dashboardService = {
  async get(startDate?: string, endDate?: string): Promise<DashboardData> {
    const params = new URLSearchParams()
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)
    const qs = params.toString()
    return apiClient<DashboardData>(`/dashboard${qs ? `?${qs}` : ""}`)
  },
}
