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

export const reportService = {
  async getTaxSummary(): Promise<TaxSummary> {
    return apiClient<TaxSummary>("/reports/tax-summary")
  },
}
