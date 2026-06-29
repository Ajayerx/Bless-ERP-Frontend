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

export interface SalesSummary {
  totalSales: number
  totalInvoices: number
  avgInvoiceValue: number
  paidTotal: number
  sentTotal: number
  overdueTotal: number
  period: string
  recentInvoices: { number: string; customerName: string; total: number; status: string; issueDate: string }[]
}

export interface StockReportItem {
  name: string
  sku: string
  stock: number
  unit: string
  price: number
  value: number
  warehouse: string
  status: string
}

export interface StockReport {
  totalProducts: number
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
  items: StockReportItem[]
}

export const reportService = {
  async getTaxSummary(): Promise<TaxSummary> {
    return apiClient<TaxSummary>("/reports/tax-summary")
  },

  async getSalesSummary(): Promise<SalesSummary> {
    return apiClient<SalesSummary>("/reports/sales-summary")
  },

  async getStockReport(): Promise<StockReport> {
    return apiClient<StockReport>("/reports/stock-report")
  },
}
