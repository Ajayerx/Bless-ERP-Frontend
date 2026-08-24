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
}

export interface InventoryAlert {
  id: string
  productName: string
  stock: number
  reorderLevel: number
  status: "out_of_stock" | "negative_stock" | "low_stock" | "overstock" | "expiring" | "pending_purchase" | "reorder_soon"
  color: string
}

export interface RecentPayment {
  id: string
  number: string
  date: string
  customerName: string
  amount: number
}

export interface TodaySales {
  amount: number
  previousDayAmount: number
  percentChange: number
  sparkline: number[]
}

export interface LowStockItem {
  id: string
  productName: string
  stock: number
  reorderLevel: number
}

export interface CustomerActivity {
  id: string
  customer: string
  action: string
  target: string
  amount: number
  date: string
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
  todaySales: TodaySales
  lowStockItems: LowStockItem[]
  activities: CustomerActivity[]
}
