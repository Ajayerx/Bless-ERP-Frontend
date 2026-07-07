import { apiClient } from "@/services/api-client"
export type { TaxBreakdownRow, TaxSummary, SalesReport, ARReport, InventoryReport, ProfitLoss, BalanceSheet } from "../types"

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
