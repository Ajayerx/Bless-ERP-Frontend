import { apiClient } from "@/services/api-client"
import { postMethod } from "@/services/frappe-client"
import { getCompanyDefaults } from "@/services/company"
import type {
  TaxSummary,
  TaxSide,
  TaxTransactionRow,
  TaxSideSummary,
  GeneralLedgerColumn,
  GeneralLedgerRow,
  GeneralLedgerFilters,
  GeneralLedgerReport,
  SalesReport,
  ARReport,
  InventoryReport,
  ProfitLoss,
  BalanceSheet,
} from "../types"
export type {
  TaxBreakdownRow,
  TaxTransactionRow,
  TaxSideSummary,
  NetRemittance,
  TaxSummary,
  SalesReport,
  ARReport,
  InventoryReport,
  ProfitLoss,
  BalanceSheet,
  GeneralLedgerColumn,
  GeneralLedgerRow,
  GeneralLedgerFilters,
  GeneralLedgerReport,
} from "../types"

interface RegisterColumn {
  label: string
  fieldname: string
  fieldtype: string
  [key: string]: unknown
}

interface RegisterRow {
  voucher_no?: string
  posting_date?: string
  customer_name?: string
  supplier_name?: string
  net_total?: number
  grand_total?: number
  [key: string]: unknown
}

interface RegisterResult {
  columns: RegisterColumn[]
  result: RegisterRow[]
}

export type TaxColumnClass = "gst" | "qst" | "other" | null

const GST_KEYWORDS = ["gst", "hst", "tps"]
const QST_KEYWORDS = ["qst", "tvq"]

export function classifyTaxColumn(label: string): TaxColumnClass {
  const lower = label.toLowerCase()
  const gst = GST_KEYWORDS.some((kw) => lower.includes(kw))
  const qst = QST_KEYWORDS.some((kw) => lower.includes(kw))
  if (gst && !qst) return "gst"
  if (qst && !gst) return "qst"
  if (gst && qst) return null
  return "other"
}

function classifyRegisterColumns(columns: RegisterColumn[]): { gst: string[]; qst: string[] } {
  const gst: string[] = []
  const qst: string[] = []
  for (const col of columns) {
    if (col.fieldtype !== "Currency") continue
    const fieldname = col.fieldname
    if (!fieldname || fieldname === "net_total" || fieldname === "grand_total" || fieldname === "tax_total") continue
    const cls = classifyTaxColumn(col.label ?? fieldname)
    if (cls === "gst") gst.push(fieldname)
    else if (cls === "qst") qst.push(fieldname)
  }
  return { gst, qst }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function buildSide(
  rows: RegisterRow[],
  classify: { gst: string[]; qst: string[] },
  side: TaxSide
): { transactions: TaxTransactionRow[]; summary: TaxSideSummary } {
  const transactions: TaxTransactionRow[] = []
  let netTotal = 0
  let gstTotal = 0
  let qstTotal = 0
  let otherTotal = 0
  let grandTotal = 0

  for (const row of rows) {
    const net = Number(row.net_total ?? 0)
    const grand = Number(row.grand_total ?? 0)
    let gst = 0
    let qst = 0
    for (const f of classify.gst) gst += Number(row[f] ?? 0)
    for (const f of classify.qst) qst += Number(row[f] ?? 0)
    gst = round2(gst)
    qst = round2(qst)

    // Reconciliation residual: anything in the grand total not explained by net
    // + known GST/QST (e.g. other tax rows, rounding) lands in "Other Tax" so
    // every row ties back exactly to the grand total. Income/expense account
    // columns are deliberately not classified so they never inflate this.
    const other = round2(grand - net - gst - qst)

    transactions.push({
      side,
      voucherNo: String(row.voucher_no ?? ""),
      partyName: side === "sales" ? String(row.customer_name ?? "") : String(row.supplier_name ?? ""),
      postingDate: String(row.posting_date ?? ""),
      subtotal: round2(net),
      gst,
      qst,
      otherTax: other,
      total: round2(grand),
    })

    netTotal += net
    gstTotal += gst
    qstTotal += qst
    otherTotal += other
    grandTotal += grand
  }

  const summary: TaxSideSummary = {
    count: transactions.length,
    netTotal: round2(netTotal),
    gst: round2(gstTotal),
    qst: round2(qstTotal),
    otherTax: round2(otherTotal),
    totalTax: round2(gstTotal + qstTotal + otherTotal),
    grandTotal: round2(grandTotal),
  }

  return { transactions, summary }
}

async function runRegister(reportName: string, filters: Record<string, unknown>): Promise<RegisterResult> {
  const message = await postMethod<RegisterResult>(
    "frappe.desk.query_report.run",
    { report_name: reportName, filters }
  )
  return {
    columns: message?.columns ?? [],
    result: message?.result ?? [],
  }
}

export const reportService = {
  async getTaxSummary(params: {
    company: string
    fromDate: string
    toDate: string
  }): Promise<TaxSummary> {
    const { company, fromDate, toDate } = params
    const filters = { company, from_date: fromDate, to_date: toDate }

    const [salesReg, purchaseReg, companyDefaults] = await Promise.all([
      runRegister("Sales Register", filters),
      runRegister("Purchase Register", filters),
      getCompanyDefaults().catch(() => null),
    ])

    const salesClassify = classifyRegisterColumns(salesReg.columns)
    const purchaseClassify = classifyRegisterColumns(purchaseReg.columns)

    const sales = buildSide(salesReg.result, salesClassify, "sales")
    const purchases = buildSide(purchaseReg.result, purchaseClassify, "purchase")

    const netGst = round2(sales.summary.gst - purchases.summary.gst)
    const netQst = round2(sales.summary.qst - purchases.summary.qst)
    const netTotal = round2(netGst + netQst)

    const transactions = [...sales.transactions, ...purchases.transactions].sort((a, b) =>
      a.postingDate.localeCompare(b.postingDate)
    )

    return {
      period: `GST/QST Summary — ${fromDate} to ${toDate}`,
      company,
      currency: companyDefaults?.currency || "CAD",
      companyTaxId: companyDefaults?.companyTaxId || "",
      fromDate,
      toDate,
      totalSales: sales.summary.netTotal,
      totalGst: sales.summary.gst,
      totalQst: sales.summary.qst,
      totalTax: sales.summary.totalTax,
      sales: sales.summary,
      purchases: purchases.summary,
      netRemittance: { gst: netGst, qst: netQst, total: netTotal },
      transactions,
      breakdown: sales.transactions.map((t) => ({
        invoiceNumber: t.voucherNo,
        customerName: t.partyName,
        issueDate: t.postingDate,
        subtotal: t.subtotal,
        gst: t.gst,
        qst: t.qst,
        total: t.total,
      })),
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
