// ERPNext-shaped Sales Register / Purchase Register report data for the mock
// servers. The contract mirrors erpnext/accounts/report/{sales,purchase}_register:
//  - One Currency column per income/expense account and per tax account head.
//  - Tax account columns carry the GST/QST identifiers in their label.
//  - net_total / grand_total are in company currency; rows are docstatus=1 only.
// The frontend parser derives GST/QST from the tax columns and treats the
// residual (grand_total - net_total - GST - QST) as "Other Tax", so income /
// expense columns never affect the totals.

export interface RegisterColumn {
  label: string
  fieldname: string
  fieldtype: string
  width: number
  options?: string
}

export interface RegisterRow {
  voucher_type?: string
  voucher_no?: string
  posting_date?: string
  customer?: string
  customer_name?: string
  supplier?: string
  supplier_name?: string
  net_total?: number
  tax_total?: number
  grand_total?: number
  rounded_total?: number
  outstanding_amount?: number
  [key: string]: unknown
}

export interface RegisterFilters {
  company?: string
  from_date?: string
  to_date?: string
}

interface RegisterInvoice {
  voucher_no: string
  posting_date: string
  party: string
  party_name: string
  net: number
  gst: number
  qst: number
}

// Computed with the Québec convention: QST applies to the GST-inclusive amount.
function qstOn(net: number, gst: number): number {
  return Math.round((net + gst) * 0.09975 * 100) / 100
}

const SALES_INVOICES: RegisterInvoice[] = [
  { voucher_no: "ACC-SINV-2026-00085", posting_date: "2026-08-04", party: "Sunrise Grocers", party_name: "Sunrise Grocers", net: 55.0, gst: 2.75, qst: qstOn(55, 2.75) },
  { voucher_no: "ACC-SINV-2026-00086", posting_date: "2026-08-06", party: "Maple Corner Cafe", party_name: "Maple Corner Cafe", net: 55.0, gst: 2.75, qst: qstOn(55, 2.75) },
  { voucher_no: "ACC-SINV-2026-00087", posting_date: "2026-08-08", party: "Sunrise Grocers", party_name: "Sunrise Grocers", net: 60.0, gst: 3.0, qst: qstOn(60, 3) },
  { voucher_no: "ACC-SINV-2026-00088", posting_date: "2026-08-09", party: "Maple Corner Cafe", party_name: "Maple Corner Cafe", net: 55.5, gst: 2.78, qst: qstOn(55.5, 2.78) },
]

const PURCHASE_INVOICES: RegisterInvoice[] = [
  { voucher_no: "ACC-PINV-2026-00001", posting_date: "2026-08-02", party: "Sweet Distributors", party_name: "Sweet Distributors", net: 200.0, gst: 10.0, qst: qstOn(200, 10) },
  { voucher_no: "ACC-PINV-2026-00002", posting_date: "2026-08-05", party: "Box Co", party_name: "Box Co", net: 80.0, gst: 4.0, qst: qstOn(80, 4) },
]

function inRange(date: string, filters: RegisterFilters): boolean {
  if (filters.from_date && date < filters.from_date) return false
  if (filters.to_date && date > filters.to_date) return false
  return true
}

function salesColumns(): RegisterColumn[] {
  return [
    { label: "Voucher Type", fieldname: "voucher_type", fieldtype: "Data", width: 120 },
    { label: "Voucher", fieldname: "voucher_no", fieldtype: "Dynamic Link", options: "voucher_type", width: 160 },
    { label: "Posting Date", fieldname: "posting_date", fieldtype: "Date", width: 100 },
    { label: "Customer", fieldname: "customer", fieldtype: "Link", options: "Customer", width: 150 },
    { label: "Customer Name", fieldname: "customer_name", fieldtype: "Data", width: 150 },
    { label: "Sales - BE", fieldname: "sales_be", fieldtype: "Currency", width: 120 },
    { label: "GST 5% on Sales - BE", fieldname: "gst_5_on_sales_be", fieldtype: "Currency", width: 120 },
    { label: "QST 9.975% on Sales - BE", fieldname: "qst_9_975_on_sales_be", fieldtype: "Currency", width: 120 },
    { label: "Net Total", fieldname: "net_total", fieldtype: "Currency", width: 120 },
    { label: "Tax Total", fieldname: "tax_total", fieldtype: "Currency", width: 120 },
    { label: "Grand Total", fieldname: "grand_total", fieldtype: "Currency", width: 120 },
    { label: "Outstanding Amount", fieldname: "outstanding_amount", fieldtype: "Currency", width: 120 },
  ]
}

function purchaseColumns(): RegisterColumn[] {
  return [
    { label: "Voucher Type", fieldname: "voucher_type", fieldtype: "Data", width: 120 },
    { label: "Voucher", fieldname: "voucher_no", fieldtype: "Dynamic Link", options: "voucher_type", width: 160 },
    { label: "Posting Date", fieldname: "posting_date", fieldtype: "Date", width: 100 },
    { label: "Supplier", fieldname: "supplier", fieldtype: "Link", options: "Supplier", width: 150 },
    { label: "Supplier Name", fieldname: "supplier_name", fieldtype: "Data", width: 150 },
    { label: "Cost of Goods Sold - BE", fieldname: "cost_of_goods_sold_be", fieldtype: "Currency", width: 120 },
    { label: "GST 5% on Purchases - BE", fieldname: "gst_5_on_purchases_be", fieldtype: "Currency", width: 120 },
    { label: "QST 9.975% on Purchases - BE", fieldname: "qst_9_975_on_purchases_be", fieldtype: "Currency", width: 120 },
    { label: "Net Total", fieldname: "net_total", fieldtype: "Currency", width: 120 },
    { label: "Tax Total", fieldname: "tax_total", fieldtype: "Currency", width: 120 },
    { label: "Grand Total", fieldname: "grand_total", fieldtype: "Currency", width: 120 },
    { label: "Outstanding Amount", fieldname: "outstanding_amount", fieldtype: "Currency", width: 120 },
  ]
}

export function generateSalesRegister(filters: RegisterFilters = {}): { columns: RegisterColumn[]; result: RegisterRow[] } {
  const result: RegisterRow[] = SALES_INVOICES.filter((inv) => inRange(inv.posting_date, filters)).map((inv) => ({
    voucher_type: "Sales Invoice",
    voucher_no: inv.voucher_no,
    posting_date: inv.posting_date,
    customer: inv.party,
    customer_name: inv.party_name,
    sales_be: inv.net,
    gst_5_on_sales_be: inv.gst,
    qst_9_975_on_sales_be: inv.qst,
    net_total: inv.net,
    tax_total: inv.gst + inv.qst,
    grand_total: inv.net + inv.gst + inv.qst,
    rounded_total: inv.net + inv.gst + inv.qst,
    outstanding_amount: 0,
  }))
  return { columns: salesColumns(), result }
}

export function generatePurchaseRegister(filters: RegisterFilters = {}): { columns: RegisterColumn[]; result: RegisterRow[] } {
  const result: RegisterRow[] = PURCHASE_INVOICES.filter((inv) => inRange(inv.posting_date, filters)).map((inv) => ({
    voucher_type: "Purchase Invoice",
    voucher_no: inv.voucher_no,
    posting_date: inv.posting_date,
    supplier: inv.party,
    supplier_name: inv.party_name,
    cost_of_goods_sold_be: inv.net,
    gst_5_on_purchases_be: inv.gst,
    qst_9_975_on_purchases_be: inv.qst,
    net_total: inv.net,
    tax_total: inv.gst + inv.qst,
    grand_total: inv.net + inv.gst + inv.qst,
    rounded_total: inv.net + inv.gst + inv.qst,
    outstanding_amount: 0,
  }))
  return { columns: purchaseColumns(), result }
}
