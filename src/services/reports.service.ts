import { apiClient } from "./api-client"

export interface TaxBreakdownRow {
  invoiceNumber: string
  customerName: string
  issueDate: string
  subtotal: number
  gst: number
  qst: number
  total: number
}

export interface TaxSummary {
  period: string
  totalSales: number
  totalGst: number
  totalQst: number
  totalTax: number
  breakdown: TaxBreakdownRow[]
}

export interface SalesReport {
  period: string
  totalSales: number
  totalOrders: number
  averageOrderValue: number
  salesByCustomer: { customerName: string; total: number; orders: number }[]
  salesByProduct: { productName: string; total: number; qty: number }[]
  monthlyTrend: { month: string; sales: number; target: number }[]
}

export interface ARReport {
  period: string
  totalOutstanding: number
  agingBuckets: Record<string, number>
  customers: { customerName: string; outstanding: number; daysOverdue: number; status: string }[]
}

export interface InventoryReport {
  period: string
  totalProducts: number
  totalValue: number
  totalCost: number
  lowStockCount: number
  outOfStockCount: number
  items: { productName: string; sku: string; stock: number; reorderLevel: number; value: number }[]
}

export interface ProfitLoss {
  period: string
  income: { totalRevenue: number; salesRevenue: number; otherIncome: number }
  expenses: { totalExpenses: number } & Record<string, number>
  netProfit: number
  netMargin: number
}

export interface BalanceSheet {
  period: string
  assets: { total: number; currentAssets: Record<string, number>; fixedAssets: Record<string, number>; otherAssets: Record<string, number> }
  liabilities: { total: number; currentLiabilities: Record<string, number>; longTermLiabilities: Record<string, number> }
  equity: { total: number; retainedEarnings: number; currentEarnings: number }
}

export const reportService = {
  async getTaxSummary(): Promise<TaxSummary> {
    return apiClient<TaxSummary>("/reports/tax-summary")
  },
  async getSalesReport(): Promise<SalesReport> {
    return apiClient<SalesReport>("/reports/sales")
  },
  async getArReport(): Promise<ARReport> {
    return apiClient<ARReport>("/reports/ar")
  },
  async getInventoryReport(): Promise<InventoryReport> {
    return apiClient<InventoryReport>("/reports/inventory")
  },
  async getProfitLoss(): Promise<ProfitLoss> {
    return apiClient<ProfitLoss>("/reports/profit-loss")
  },
  async getBalanceSheet(): Promise<BalanceSheet> {
    return apiClient<BalanceSheet>("/reports/balance-sheet")
  },
}
