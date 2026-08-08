import { apiClient } from "@/services/api-client"
import { postMethod } from "@/services/frappe-client"
import type { TaxSummary, GeneralLedgerColumn, GeneralLedgerRow, GeneralLedgerFilters, GeneralLedgerReport } from "../types"
export type { TaxBreakdownRow, TaxSummary, SalesReport, ARReport, InventoryReport, ProfitLoss, BalanceSheet, GeneralLedgerColumn, GeneralLedgerRow, GeneralLedgerFilters, GeneralLedgerReport } from "../types"

interface FrappeTaxRow {
  account_head: string
  tax_amount: number
}

interface FrappeSalesInvoice {
  name: string
  customer_name: string
  posting_date: string
  grand_total: number
  base_net_total: number
  taxes: FrappeTaxRow[]
}

function matchesTaxAccount(accountHead: string, keywords: string[]): boolean {
  const lower = accountHead.toLowerCase()
  return keywords.some(kw => lower.includes(kw))
}

export const reportService = {
  async getTaxSummary(fromDate?: string, toDate?: string): Promise<TaxSummary> {
    const filters: unknown[][] = [["docstatus", "=", 1]]

    if (fromDate) filters.push(["posting_date", ">=", fromDate])
    if (toDate) filters.push(["posting_date", "<=", toDate])

    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify(["name", "customer_name", "posting_date", "grand_total", "base_net_total"]))
    qp.set("filters", JSON.stringify(filters))
    qp.set("limit_page_length", "0")
    qp.set("order_by", "posting_date asc")

    const invoices = await apiClient<FrappeSalesInvoice[]>(`/resource/Sales%20Invoice?${qp.toString()}`)

    const breakdown: TaxSummary["breakdown"] = []
    let totalGst = 0
    let totalQst = 0
    let totalSales = 0

    const fullDocs = await Promise.all(
      invoices.map(inv =>
        apiClient<FrappeSalesInvoice>(`/resource/Sales%20Invoice/${encodeURIComponent(inv.name)}?fields=${encodeURIComponent(JSON.stringify(["taxes"]))}`)
      )
    )

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i]
      const taxes = fullDocs[i].taxes ?? []

      let gstAmount = 0
      let qstAmount = 0
      for (const t of taxes) {
        if (matchesTaxAccount(t.account_head, ["gst", "tpsd", "gst/hst"])) {
          gstAmount += t.tax_amount
        } else if (matchesTaxAccount(t.account_head, ["qst", "tvpq"])) {
          qstAmount += t.tax_amount
        }
      }

      totalSales += inv.base_net_total
      totalGst += gstAmount
      totalQst += qstAmount

      breakdown.push({
        invoiceNumber: inv.name,
        customerName: inv.customer_name,
        issueDate: inv.posting_date,
        subtotal: inv.base_net_total,
        gst: gstAmount,
        qst: qstAmount,
        total: inv.grand_total,
      })
    }

    const periodLabel = fromDate && toDate
      ? `${fromDate} to ${toDate}`
      : fromDate
        ? `From ${fromDate}`
        : toDate
          ? `Up to ${toDate}`
          : "All time"

    return {
      period: `GST/QST Summary — ${periodLabel}`,
      totalSales,
      totalGst,
      totalQst,
      totalTax: totalGst + totalQst,
      breakdown,
    }
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

  // Runs the ERPNext "General Ledger" query report via frappe.desk.query_report.run.
  // All rows are returned verbatim — including the Opening / Total / Closing
  // summary rows ERPNext computes server-side (identified by a missing
  // posting_date and the label in `account`).
  async getGeneralLedger(filters: GeneralLedgerFilters): Promise<GeneralLedgerReport> {
    const message = await postMethod<{ columns: GeneralLedgerColumn[]; result: GeneralLedgerRow[] }>(
      "frappe.desk.query_report.run",
      { report_name: "General Ledger", filters }
    )
    const columns = message?.columns ?? []
    const rows = message?.result ?? []
    return { columns, rows }
  },
}
