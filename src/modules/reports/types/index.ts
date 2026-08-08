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

export interface GeneralLedgerColumn {
  label: string
  fieldname: string
  fieldtype: string
  width?: number
  options?: string
  hidden?: number
}

export interface GeneralLedgerRow {
  gl_entry?: string
  posting_date?: string
  account: string
  debit?: number
  credit?: number
  balance?: number
  voucher_type?: string
  voucher_no?: string
  against?: string
  party_type?: string
  party?: string
  party_name?: string
  voucher_subtype?: string
  remarks?: string
  cost_center?: string
  project?: string
  against_voucher_type?: string
  against_voucher?: string
  bill_no?: string
  is_opening?: string
  account_currency?: string
  presentation_currency?: string
  debit_in_account_currency?: number
  credit_in_account_currency?: number
  debit_in_transaction_currency?: number | null
  credit_in_transaction_currency?: number | null
  transaction_currency?: string
  [key: string]: unknown
}

export interface GeneralLedgerFilters {
  company: string
  from_date: string
  to_date: string
  account?: string[]
  voucher_no?: string
  against_voucher_no?: string
  party_type?: string
  party?: string[]
  categorize_by?: string
  finance_book?: string
  presentation_currency?: string
  cost_center?: string[]
  project?: string[]
  include_dimensions?: 0 | 1
  disable_opening_balance_calculation?: 0 | 1
  show_opening_entries?: 0 | 1
  include_default_book_entries?: 0 | 1
  show_net_values_in_party_account?: 0 | 1
  show_amount_in_company_currency?: 0 | 1
  add_values_in_transaction_currency?: 0 | 1
  show_remarks?: 0 | 1
  ignore_err?: 0 | 1
  ignore_cr_dr_notes?: 0 | 1
  show_cancelled_entries?: 0 | 1
  [key: string]: unknown
}

export interface GeneralLedgerReport {
  columns: GeneralLedgerColumn[]
  rows: GeneralLedgerRow[]
}
