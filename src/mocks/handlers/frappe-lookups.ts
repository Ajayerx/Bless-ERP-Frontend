import { http, HttpResponse, delay } from "msw"

// ── Sales Invoices (15 records) ──────────────────────────────────────
export const salesInvoices = [
  { name: "SINV-2026-0001", customer: "CUST-0001", customer_name: "Maple Leaf Bakery", grand_total: 2450.00, outstanding_amount: 0, posting_date: "2026-07-01", due_date: "2026-07-15", creation: "2026-07-01T10:15:00", status: "Paid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-05T09:20:00", modified_by: "jane.doe@blesserp.com", _assign: '["jane.doe@blesserp.com"]', _user_tags: "Audit,Needs-Review" },
  { name: "SINV-2026-0002", customer: "CUST-0002", customer_name: "Northern Lights Coffee", grand_total: 1890.50, outstanding_amount: 1890.50, posting_date: "2026-07-01", due_date: "2026-07-15", creation: "2026-07-01T11:30:00", status: "Unpaid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-01T11:30:00", modified_by: "admin@blesserp.com", _assign: '["aarav@blesserp.com"]' },
  { name: "SINV-2026-0003", customer: "CUST-0003", customer_name: "Blue Mountain Supplies", grand_total: 3720.00, outstanding_amount: 1500.00, posting_date: "2026-07-02", due_date: "2026-07-16", creation: "2026-07-02T09:00:00", status: "Partly Paid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-02T09:00:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0004", customer: "CUST-0004", customer_name: "Great Lakes Trading", grand_total: 560.75, outstanding_amount: 0, posting_date: "2026-07-02", due_date: "2026-07-16", creation: "2026-07-02T14:20:00", status: "Paid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-02T14:20:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0005", customer: "CUST-0005", customer_name: "Red Maple Imports", grand_total: 4150.00, outstanding_amount: 4150.00, posting_date: "2026-07-03", due_date: "2026-07-17", creation: "2026-07-03T08:45:00", status: "Overdue", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-03T08:45:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0006", customer: "CUST-0001", customer_name: "Maple Leaf Bakery", grand_total: 890.25, outstanding_amount: 0, posting_date: "2026-07-03", due_date: "2026-07-17", creation: "2026-07-03T16:10:00", status: "Paid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-03T16:10:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0007", customer: "CUST-0006", customer_name: "Pacific Coast Distributors", grand_total: 6780.00, outstanding_amount: 3400.00, posting_date: "2026-07-04", due_date: "2026-07-18", creation: "2026-07-04T10:00:00", status: "Partly Paid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-04T10:00:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0008", customer: "CUST-0002", customer_name: "Northern Lights Coffee", grand_total: 1230.00, outstanding_amount: 0, posting_date: "2026-07-04", due_date: "2026-07-18", creation: "2026-07-04T13:30:00", status: "Paid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-04T13:30:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0009", customer: "CUST-0007", customer_name: "Prairie Grain Co.", grand_total: 2950.00, outstanding_amount: 2950.00, posting_date: "2026-07-05", due_date: "2026-07-19", creation: "2026-07-05T09:15:00", status: "Unpaid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-05T09:15:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0010", customer: "CUST-0003", customer_name: "Blue Mountain Supplies", grand_total: 340.00, outstanding_amount: 0, posting_date: "2026-07-05", due_date: "2026-07-19", creation: "2026-07-05T15:00:00", status: "Paid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-05T15:00:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0011", customer: "CUST-0008", customer_name: "Eastern Seafood Co.", grand_total: 5120.00, outstanding_amount: 5120.00, posting_date: "2026-07-06", due_date: "2026-07-20", creation: "2026-07-06T08:30:00", status: "Overdue", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-06T08:30:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0012", customer: "CUST-0004", customer_name: "Great Lakes Trading", grand_total: 1875.00, outstanding_amount: 1875.00, posting_date: "2026-07-06", due_date: "2026-07-20", creation: "2026-07-06T11:00:00", status: "Unpaid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-06T11:00:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0013", customer: "CUST-0009", customer_name: "Golden Harvest Organic", grand_total: 4300.00, outstanding_amount: 0, posting_date: "2026-07-07", due_date: "2026-07-21", creation: "2026-07-07T10:45:00", status: "Paid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-07T10:45:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0014", customer: "CUST-0010", customer_name: "Summit Logistics", grand_total: 2890.00, outstanding_amount: 2890.00, posting_date: "2026-07-07", due_date: "2026-07-21", creation: "2026-07-07T14:20:00", status: "Unpaid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-07T14:20:00", modified_by: "admin@blesserp.com" },
  { name: "SINV-2026-0015", customer: "CUST-0001", customer_name: "Maple Leaf Bakery", grand_total: 1670.50, outstanding_amount: 800.00, posting_date: "2026-07-08", due_date: "2026-07-22", creation: "2026-07-08T09:30:00", status: "Partly Paid", docstatus: 1, owner: "admin@blesserp.com", modified: "2026-07-08T09:30:00", modified_by: "admin@blesserp.com" },
]

// ── Sample child tables so Duplicate / Return (Create menu) prefill works in demo ──
const salesInvoiceItems = [
  { item_code: "PRD-001", item_name: "Organic All-Purpose Flour", qty: 40, rate: 25.00, amount: 1000.00, uom: "Nos", warehouse: "Main Warehouse", income_account: "Income - BE", cost_center: "Main - BE", discount_percentage: 0, grant_commission: 1 },
  { item_code: "PRD-005", item_name: "Maple Syrup (Grade A)", qty: 58, rate: 25.00, amount: 1450.00, uom: "Nos", warehouse: "Main Warehouse", income_account: "Income - BE", cost_center: "Main - BE", discount_percentage: 0, grant_commission: 1 },
]
const salesInvoiceTaxes = [
  { charge_type: "On Net Total", account_head: "GST Tax - BE", description: "GST 5%", rate: 5, included_in_print_rate: 0 },
  { charge_type: "On Net Total", account_head: "QST Tax - BE", description: "QST 9.975%", rate: 9.975, included_in_print_rate: 0 },
]

// ── Payment Entries (10 records) ──────────────────────────────────────
export const paymentEntries = [
  { name: "PAY-2026-0001", party: "CUST-0001", party_name: "Maple Leaf Bakery", paid_amount: 2450.00, payment_type: "Receive", posting_date: "2026-07-02", creation: "2026-07-02T12:00:00", docstatus: 1, _assign: '["aarav@blesserp.com"]', _user_tags: "Audit,Q1-Review" },
  { name: "PAY-2026-0002", party: "CUST-0004", party_name: "Great Lakes Trading", paid_amount: 560.75, payment_type: "Receive", posting_date: "2026-07-03", creation: "2026-07-03T10:30:00", docstatus: 1, _assign: '["aarav@blesserp.com","jane.doe@blesserp.com"]', _user_tags: "Follow-up" },
  { name: "PAY-2026-0003", party: "CUST-0003", party_name: "Blue Mountain Supplies", paid_amount: 2220.00, payment_type: "Receive", posting_date: "2026-07-04", creation: "2026-07-04T14:15:00", docstatus: 1, _assign: '["priya@blesserp.com"]' },
  { name: "PAY-2026-0004", party: "CUST-0001", party_name: "Maple Leaf Bakery", paid_amount: 890.25, payment_type: "Receive", posting_date: "2026-07-04", creation: "2026-07-04T16:45:00", docstatus: 1 },
  { name: "PAY-2026-0005", party: "CUST-0002", party_name: "Northern Lights Coffee", paid_amount: 1230.00, payment_type: "Receive", posting_date: "2026-07-05", creation: "2026-07-05T11:00:00", docstatus: 1 },
  { name: "PAY-2026-0006", party: "CUST-0003", party_name: "Blue Mountain Supplies", paid_amount: 340.00, payment_type: "Receive", posting_date: "2026-07-06", creation: "2026-07-06T09:30:00", docstatus: 1 },
  { name: "PAY-2026-0007", party: "CUST-0009", party_name: "Golden Harvest Organic", paid_amount: 4300.00, payment_type: "Receive", posting_date: "2026-07-07", creation: "2026-07-07T15:00:00", docstatus: 1 },
  { name: "PAY-2026-0008", party: "SUPP-0001", party_name: "Ontario Fresh Produce", paid_amount: 1200.00, payment_type: "Pay", posting_date: "2026-07-02", creation: "2026-07-02T10:00:00", docstatus: 1 },
  { name: "PAY-2026-0009", party: "SUPP-0002", party_name: "Quebec Dairy Co.", paid_amount: 2800.00, payment_type: "Pay", posting_date: "2026-07-05", creation: "2026-07-05T14:30:00", docstatus: 1 },
  { name: "PAY-2026-0010", party: "CUST-0007", party_name: "Prairie Grain Co.", paid_amount: 950.00, payment_type: "Receive", posting_date: "2026-07-06", creation: "2026-07-06T13:00:00", docstatus: 1 },
]

// ── Bins (stock levels) ──────────────────────────────────────────────
const bins = [
  { item_code: "PRD-001", warehouse: "Main Warehouse", actual_qty: 150, stock_value: 3750.00 },
  { item_code: "PRD-002", warehouse: "Main Warehouse", actual_qty: 0, stock_value: 0 },
  { item_code: "PRD-003", warehouse: "Main Warehouse", actual_qty: 3, stock_value: 150.00 },
  { item_code: "PRD-004", warehouse: "Cold Storage", actual_qty: 23, stock_value: 575.00 },
  { item_code: "PRD-005", warehouse: "Main Warehouse", actual_qty: 1, stock_value: 45.00 },
  { item_code: "PRD-006", warehouse: "Main Warehouse", actual_qty: 200, stock_value: 4000.00 },
  { item_code: "PRD-007", warehouse: "Cold Storage", actual_qty: -2, stock_value: -60.00 },
  { item_code: "PRD-008", warehouse: "Main Warehouse", actual_qty: 12, stock_value: 240.00 },
  { item_code: "PRD-001", warehouse: "Cold Storage", actual_qty: 80, stock_value: 2000.00 },
  { item_code: "PRD-009", warehouse: "Main Warehouse", actual_qty: 45, stock_value: 1125.00 },
  { item_code: "PRD-010", warehouse: "Main Warehouse", actual_qty: 5, stock_value: 250.00 },
  { item_code: "PRD-003", warehouse: "Cold Storage", actual_qty: 60, stock_value: 3000.00 },
  { item_code: "PRD-011", warehouse: "Main Warehouse", actual_qty: 3, stock_value: 90.00 },
  { item_code: "PRD-012", warehouse: "Main Warehouse", actual_qty: 120, stock_value: 3600.00 },
  { item_code: "PRD-013", warehouse: "Cold Storage", actual_qty: 35, stock_value: 875.00 },
  { item_code: "PRD-014", warehouse: "Main Warehouse", actual_qty: 150, stock_value: 2250.00 },
  { item_code: "PRD-015", warehouse: "Main Warehouse", actual_qty: 0, stock_value: 0 },
  { item_code: "PRD-002", warehouse: "Cold Storage", actual_qty: 10, stock_value: 200.00 },
  { item_code: "PRD-008", warehouse: "Cold Storage", actual_qty: 4, stock_value: 80.00 },
  { item_code: "PRD-010", warehouse: "Cold Storage", actual_qty: 25, stock_value: 1250.00 },
  { item_code: "PRD-011", warehouse: "Cold Storage", actual_qty: 0, stock_value: 0 },
  { item_code: "PRD-014", warehouse: "Cold Storage", actual_qty: 55, stock_value: 825.00 },
]

// ── Items ─────────────────────────────────────────────────────────────
const items = [
  { item_code: "PRD-001", item_name: "Organic All-Purpose Flour", shelf_life_in_days: 365 },
  { item_code: "PRD-002", item_name: "Cold-Pressed Canola Oil", shelf_life_in_days: 180 },
  { item_code: "PRD-003", item_name: "Wild Blueberry Jam", shelf_life_in_days: 730 },
  { item_code: "PRD-004", item_name: "Atlantic Smoked Salmon", shelf_life_in_days: 90 },
  { item_code: "PRD-005", item_name: "Maple Syrup (Grade A)", shelf_life_in_days: 1095 },
  { item_code: "PRD-006", item_name: "Canadian Hard Red Wheat", shelf_life_in_days: 365 },
  { item_code: "PRD-007", item_name: "Fresh Atlantic Cod Fillets", shelf_life_in_days: 7 },
  { item_code: "PRD-008", item_name: "Quebec Aged Cheddar", shelf_life_in_days: 180 },
  { item_code: "PRD-009", item_name: "Natural Canadian Honey", shelf_life_in_days: 1095 },
  { item_code: "PRD-010", item_name: "Organic Mixed Greens", shelf_life_in_days: 5 },
  { item_code: "PRD-011", item_name: "Artisan Sourdough Bread", shelf_life_in_days: 5 },
  { item_code: "PRD-012", item_name: "Alberta Beef Jerky", shelf_life_in_days: 365 },
  { item_code: "PRD-013", item_name: "Frozen Wild Blueberries", shelf_life_in_days: 730 },
  { item_code: "PRD-014", item_name: "Craft Soda Sampler Pack", shelf_life_in_days: 365 },
  { item_code: "PRD-015", item_name: "Gluten-Free Pancake Mix", shelf_life_in_days: 270 },
]

// ── Item Prices ──────────────────────────────────────────────────────
const itemPrices = [
  { name: "IPR-001", item_code: "PRD-001", price_list: "Standard Selling", price_list_rate: 25.00, currency: "CAD", selling: 1, buying: 0, valid_from: "2026-01-01", valid_upto: "2026-12-31" },
  { name: "IPR-002", item_code: "PRD-001", price_list: "Standard Buying", price_list_rate: 18.00, currency: "CAD", selling: 0, buying: 1, valid_from: "2026-01-01", valid_upto: "2026-12-31" },
  { name: "IPR-003", item_code: "PRD-002", price_list: "Standard Selling", price_list_rate: 5.50, currency: "CAD", selling: 1, buying: 0, valid_from: "2026-01-01", valid_upto: "2026-12-31" },
  { name: "IPR-004", item_code: "PRD-002", price_list: "Standard Buying", price_list_rate: 3.20, currency: "CAD", selling: 0, buying: 1, valid_from: "2026-01-01", valid_upto: "2026-12-31" },
  { name: "IPR-005", item_code: "PRD-003", price_list: "Standard Selling", price_list_rate: 15.00, currency: "CAD", selling: 1, buying: 0, valid_from: "2026-01-01", valid_upto: "2026-12-31" },
  { name: "IPR-006", item_code: "PRD-003", price_list: "Standard Buying", price_list_rate: 9.50, currency: "CAD", selling: 0, buying: 1, valid_from: "2026-01-01", valid_upto: "2026-12-31" },
  { name: "IPR-007", item_code: "PRD-004", price_list: "Standard Selling", price_list_rate: 9.00, currency: "CAD", selling: 1, buying: 0, valid_from: "2026-01-01", valid_upto: "2026-12-31" },
  { name: "IPR-008", item_code: "PRD-004", price_list: "Standard Buying", price_list_rate: 5.00, currency: "CAD", selling: 0, buying: 1, valid_from: "2026-01-01", valid_upto: "2026-12-31" },
  { name: "IPR-009", item_code: "PRD-005", price_list: "Standard Selling", price_list_rate: 28.00, currency: "CAD", selling: 1, buying: 0, valid_from: "2026-01-01", valid_upto: "2026-12-31" },
  { name: "IPR-010", item_code: "PRD-005", price_list: "Standard Buying", price_list_rate: 16.00, currency: "CAD", selling: 0, buying: 1, valid_from: "2026-01-01", valid_upto: "2026-12-31" },
]

// ── Batches (expiring) ───────────────────────────────────────────────
const today = new Date()
const batchDate = (daysFromNow: number) =>
  new Date(today.getTime() + daysFromNow * 86400000).toISOString().slice(0, 10)

const batches = [
  { name: "BATCH-001", item: "PRD-004", expiry_date: batchDate(5), batch_qty: 20 },
  { name: "BATCH-002", item: "PRD-007", expiry_date: batchDate(3), batch_qty: 15 },
  { name: "BATCH-003", item: "PRD-010", expiry_date: batchDate(2), batch_qty: 30 },
  { name: "BATCH-004", item: "PRD-011", expiry_date: batchDate(1), batch_qty: 12 },
  { name: "BATCH-005", item: "PRD-013", expiry_date: batchDate(20), batch_qty: 50 },
  { name: "BATCH-006", item: "PRD-004", expiry_date: batchDate(14), batch_qty: 8 },
  { name: "BATCH-007", item: "PRD-002", expiry_date: batchDate(60), batch_qty: 25 },
  { name: "BATCH-008", item: "PRD-008", expiry_date: batchDate(45), batch_qty: 10 },
  { name: "BATCH-009", item: "PRD-001", expiry_date: batchDate(150), batch_qty: 100 },
  { name: "BATCH-010", item: "PRD-010", expiry_date: batchDate(4), batch_qty: 5 },
]

// ── Draft Purchase Orders ────────────────────────────────────────────
interface POBatchDoc {
  name: string
  items: { item_code: string }[]
  docstatus: number
}
const poDocs: POBatchDoc[] = [
  { name: "PUR-ORD-2026-0001", items: [{ item_code: "PRD-001" }, { item_code: "PRD-003" }, { item_code: "PRD-008" }], docstatus: 0 },
  { name: "PUR-ORD-2026-0002", items: [{ item_code: "PRD-005" }, { item_code: "PRD-010" }], docstatus: 0 },
  { name: "PUR-ORD-2026-0003", items: [{ item_code: "PRD-012" }, { item_code: "PRD-014" }, { item_code: "PRD-002" }], docstatus: 0 },
]

// ── Global Defaults ───────────────────────────────────────────────────
const globalDefaults = {
  default_company: "BlessERP Inc.",
  default_currency: "CAD",
  country: "Canada",
}

// ── Lookup doctypes ──────────────────────────────────────────────────
const linkOptions: Record<string, string[]> = {
  "Customer Group": ["Commercial", "Individual", "Government", "Non-Profit", "Retailer"],
  "Territory": ["Canada", "United States", "United Kingdom", "Australia", "Europe", "Asia"],
  "Salutation": ["Mr", "Mrs", "Ms", "Dr", "Prof", "Sir"],
  "Gender": ["Male", "Female", "Other"],
  "Currency": ["CAD", "USD", "EUR", "GBP", "AUD"],
  "Bank Account": ["Business Chequing - TD Bank", "Savings - RBC", "USD Account - BMO"],
  "Price List": ["Standard Selling", "Wholesale", "Retail", "Export", "Promotional"],
  "Company": ["BlessERP Inc.", "BlessERP US Inc."],
  "Market Segment": ["SMB", "Mid-Market", "Enterprise", "Government"],
  "Industry Type": ["Food & Beverage", "Wholesale", "Distribution", "Agriculture", "Retail", "Manufacturing", "Logistics", "Construction"],
  "Language": ["en", "fr", "es", "de"],
  "Tax Category": ["Standard", "Zero Rated", "Exempt", "Reverse Charge"],
  "Tax Withholding Category": ["Standard TDS", "Professional Fees", "Contractor Payments"],
  "Payment Terms Template": ["Net 30", "Net 15", "Net 45", "Net 60", "Due on Receipt"],
  "Loyalty Program": ["Gold Rewards", "Platinum Rewards", "Silver Benefits"],
  "Sales Partner": ["ABC Sales Agency", "Northern Distributors", "Pacific Sales Group"],
  "Account": ["Accounts Receivable", "Accounts Payable", "Cash on Hand", "Sales Revenue", "Cost of Goods Sold"],
  "Sales Person": ["John Smith", "Jane Doe", "Bob Johnson", "Alice Brown"],
}

// ── Helpers ──────────────────────────────────────────────────────────
function safeJsonParse<T>(val: string | null, fallback: T): T {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}

function parseQSParams(url: string) {
  const u = new URL(url, "http://localhost")
  const filters: unknown[] = safeJsonParse(u.searchParams.get("filters"), [])
  const orFilters: unknown[] = safeJsonParse(u.searchParams.get("or_filters"), [])
  const orderBy = u.searchParams.get("order_by") ?? ""
  const limitPageLength = Number(u.searchParams.get("limit_page_length") ?? 0)
  const limitStart = Number(u.searchParams.get("limit_start") ?? 0)
  return { filters, orFilters, orderBy, limitPageLength, limitStart }
}

// Applies an ERPNext `order_by` clause ("posting_date desc", "grand_total asc")
// to an in-memory row list. Mirrors frappe.utils.get_order_by.
function applyOrderBy(rows: Record<string, unknown>[], orderBy: string): Record<string, unknown>[] {
  if (!orderBy.trim()) return rows
  const [field, dir] = orderBy.trim().split(/\s+/, 2)
  if (!field) return rows
  const mult = (dir ?? "desc").toLowerCase() === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = a[field]
    const vb = b[field]
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult
    return String(va).localeCompare(String(vb)) * mult
  })
}

export function matchesFilter(row: Record<string, unknown>, filters: unknown[]): boolean {
  for (const raw of filters) {
    if (!Array.isArray(raw)) continue
    const f = raw as unknown[]
    if (f[0] === "OR") {
      const orGroups = f.slice(1) as unknown[][]
      const orMatched = orGroups.some((g) => matchesFilter(row, g))
      if (!orMatched) return false
      continue
    }
    if (f.length < 3) continue
    const [field, operator, value] = f as [string, string, unknown]
    const rowVal = row[field]
    if (operator === "=") {
      // eslint-disable-next-line eqeqeq
      if (rowVal != value) return false
    } else if (operator === "like" && typeof value === "string") {
      if (!String(rowVal).toLowerCase().includes(value.replace(/%/g, "").toLowerCase())) return false
    } else if (operator === "in" && Array.isArray(value)) {
      if (!value.includes(rowVal)) return false
    } else if (operator === ">" && typeof value === "number") {
      if (Number(rowVal) <= value) return false
    } else if (operator === "between" && Array.isArray(value) && value.length === 2) {
      const d = new Date(String(rowVal))
      if (d < new Date(String(value[0])) || d > new Date(String(value[1]))) return false
    }
  }
  return true
}

// Combines the top-level `filters` (AND) with `or_filters` (match at least one
// group) — mirrors how Frappe's db_query applies both.
export function matchesFilterSet(
  row: Record<string, unknown>,
  filters: unknown[],
  orFilters: unknown[]
): boolean {
  if (filters.length > 0 && !matchesFilter(row, filters)) return false
  if (orFilters.length > 0) {
    const orMatched = orFilters.some((f) => matchesFilter(row, [f]))
    if (!orMatched) return false
  }
  return true
}

// ── Doctype data registry ────────────────────────────────────────────
const listData: Record<string, Record<string, unknown>[]> = {
  "Sales Invoice": salesInvoices as unknown as Record<string, unknown>[],
  "Payment Entry": paymentEntries as unknown as Record<string, unknown>[],
  "Bin": bins as unknown as Record<string, unknown>[],
  "Item": items as unknown as Record<string, unknown>[],
  "Item Price": itemPrices as unknown as Record<string, unknown>[],
  "Batch": batches as unknown as Record<string, unknown>[],
  "Purchase Order": poDocs as unknown as Record<string, unknown>[],
}

// ── Handlers ────────────────────────────────────────────────────────
// Registered LAST — catches any /api/resource/:doctype that no other handler matched.
export const frappeLookupHandlers = [
  // ── Single document fetch: /api/resource/{doctype}/{name} ────────
  http.get("/api/resource/:doctype/:name", async ({ params }) => {
    await delay(80)
    const doctype = decodeURIComponent(params.doctype as string)
    const name = decodeURIComponent(params.name as string)

    // Purchase Order single doc (for fetchPendingPurchaseItems)
    if (doctype === "Purchase Order") {
      const doc = poDocs.find((p) => p.name === name)
      return HttpResponse.json({ data: doc ?? null })
    }

    // Sales Invoice single doc (invoice workspace getById) — serves the list
    // row enriched with ERPNext metadata fields.
    if (doctype === "Sales Invoice") {
      const row = salesInvoices.find((s) => s.name === name)
      if (!row) return HttpResponse.json({ data: null })
      return HttpResponse.json({
        data: {
          name: row.name,
          doctype: "Sales Invoice",
          customer: row.customer,
          customer_name: row.customer_name,
          grand_total: row.grand_total,
          outstanding_amount: row.outstanding_amount,
          paid_amount: row.grand_total - row.outstanding_amount,
          posting_date: row.posting_date,
          due_date: row.due_date ?? "",
          status: row.status,
          docstatus: row.docstatus,
          company: "BlessERP Inc.",
          currency: "CAD",
          selling_price_list: "Standard Selling",
          cost_center: "Main - BE",
          taxes_and_charges: "Canada GST/QST - BE",
          items: salesInvoiceItems,
          taxes: salesInvoiceTaxes,
          owner: row.owner,
          creation: row.creation,
          modified: row.modified ?? row.creation,
          modified_by: row.modified_by ?? row.owner,
        },
      })
    }

    return HttpResponse.json({ data: null })
  }),

  // ── Single document update: /api/resource/{doctype}/{name} ──────────
  http.put("/api/resource/:doctype/:name", async ({ params, request }) => {
    await delay(80)
    const doctype = decodeURIComponent(params.doctype as string)
    const name = decodeURIComponent(params.name as string)

    // Sales Invoice submit/update path (invoice workspace submit/update).
    // Merge the payload into the stored row but KEEP docstatus as-is, matching
    // ERPNext: an update on a Submitted doc never resets it to Draft, and a
    // submit() call sets docstatus=1 explicitly in its payload.
    if (doctype === "Sales Invoice") {
      const idx = salesInvoices.findIndex((s) => s.name === name)
      if (idx === -1) {
        return HttpResponse.json({ message: "Not Found" }, { status: 404 })
      }
      const body = (await request.json()) as Record<string, unknown>
      salesInvoices[idx] = { ...salesInvoices[idx], ...body, modified: new Date().toISOString().replace("T", " ").slice(0, 19) }
      const row = salesInvoices[idx]
      return HttpResponse.json({
        data: {
          name: row.name,
          doctype: "Sales Invoice",
          customer: row.customer,
          customer_name: row.customer_name,
          grand_total: row.grand_total,
          outstanding_amount: row.outstanding_amount,
          paid_amount: row.grand_total - row.outstanding_amount,
          posting_date: row.posting_date,
          due_date: row.due_date ?? "",
          status: row.status,
          docstatus: row.docstatus,
          company: "BlessERP Inc.",
          currency: "CAD",
          selling_price_list: "Standard Selling",
          cost_center: "Main - BE",
          taxes_and_charges: "Canada GST/QST - BE",
          items: salesInvoiceItems,
          taxes: salesInvoiceTaxes,
          owner: row.owner,
          creation: row.creation,
          modified: row.modified ?? row.creation,
          modified_by: row.modified_by ?? row.owner,
        },
      })
    }
    return HttpResponse.json({ data: null })
  }),

  // ── List / single document via query params: /api/resource/{doctype} ──
  http.get("/api/resource/:doctype", async ({ params, request }) => {
    await delay(80)
    const doctype = decodeURIComponent(params.doctype as string)

    // Global Defaults (single doc, no query params)
    if (doctype === "Global Defaults") {
      return HttpResponse.json({ data: globalDefaults })
    }

    // User list (assignee-name resolution: resolveUserNames)
    if (doctype === "User") {
      return HttpResponse.json({
        data: [
          { name: "admin@blesserp.com", full_name: "BlessERP Admin" },
          { name: "john.smith@blesserp.com", full_name: "John Smith" },
          { name: "jane.doe@blesserp.com", full_name: "Jane Doe" },
          { name: "aarav@blesserp.com", full_name: "Aarav Mehta" },
          { name: "priya@blesserp.com", full_name: "Priya Sharma" },
          { name: "neha@blesserp.com", full_name: "Neha Gupta" },
          { name: "vivek@blesserp.com", full_name: "Vivek Nair" },
        ],
      })
    }

    // Dashboard & other list doctypes
    const rows = listData[doctype]
    if (rows) {
      const { filters, orFilters, orderBy, limitPageLength, limitStart } = parseQSParams(request.url)
      let filtered = filters.length > 0 || orFilters.length > 0
        ? rows.filter((r) => matchesFilterSet(r, filters, orFilters))
        : rows
      filtered = applyOrderBy(filtered, orderBy)
      if (limitPageLength > 0) {
        filtered = filtered.slice(limitStart, limitStart + limitPageLength)
      }
      return HttpResponse.json({ data: filtered })
    }

    // Link-option lookups
    const options = linkOptions[doctype]
    if (options) {
      return HttpResponse.json({ data: options.map((n) => ({ name: n })) })
    }

    return HttpResponse.json({ data: [] })
  }),
]
