/**
 * ERPNext `Purchase Invoice` types (mirrors purchase_invoice.json + the
 * Purchase Invoice Item / Purchase Taxes and Charges child tables).
 */

export type PurchaseInvoiceStatus =
  | "draft"
  | "submitted"
  | "cancelled"
  | "not_paid"
  | "partly_paid"
  | "paid"
  | "overdue"
  | "return"
  | "credit_note_issued"

export type PurchaseInvoiceRawStatus = string

export type PurchaseInvoiceDocstatus = 0 | 1 | 2

export interface PurchaseInvoiceItem {
  name: string
  itemCode: string
  itemName: string
  description?: string
  qty: number
  rate: number
  amount: number
  uom?: string
  conversionFactor: number
  warehouse?: string
  costCenter?: string
  project?: string
  expenseAccount?: string
  purchaseOrder?: string
  purchaseOrderItem?: string
}

export interface PurchaseInvoice {
  id: string
  name: string
  number: string
  supplierId: string
  supplierName: string
  postingDate: string
  dueDate: string
  company: string
  currency: string
  status: PurchaseInvoiceStatus
  indicator: string
  docstatus: PurchaseInvoiceDocstatus
  items: PurchaseInvoiceItem[]
  totalNet: number
  totalTaxes: number
  grandTotal: number
  roundedTotal: number
  outstandingAmount: number
  paidAmount: number
  totalQty: number
  createdAt: string
  modified: string
}

export interface PurchaseInvoiceListResponse {
  items: PurchaseInvoice[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** Form row shape for the items grid (snake_case, mirrors ERPNext child rows). */
export interface PurchaseInvoiceItemForm {
  name: string
  item_code: string
  item_name: string
  description?: string
  uom?: string
  conversion_factor?: number
  qty: number
  price_list_rate?: number
  rate: number
  amount: number
  discount_percentage?: number
  warehouse?: string
  cost_center?: string
  expense_account?: string
  project?: string
  purchase_order?: string
  purchase_order_item?: string
}

/** Form row shape for the taxes grid (snake_case, mirrors ERPNext child rows). */
export interface PurchaseInvoiceTaxFormRow {
  name: string
  charge_type: "On Net Total" | "On Item Total" | "Actual"
  account_head: string
  description?: string
  rate: number
  tax_amount: number
  total: number
  included_in_print_rate?: number
}

export interface PurchaseInvoiceFormData {
  doctype: "Purchase Invoice"
  name?: string
  naming_series: string
  supplier: string
  supplier_name: string
  posting_date: string
  due_date: string
  company: string
  currency: string
  conversion_rate: number
  buying_price_list?: string
  price_list_currency?: string
  plc_conversion_rate?: number
  set_warehouse?: string
  cost_center?: string
  taxes_and_charges?: string
  contact_person?: string
  contact_email?: string
  address_display?: string
  payment_terms_template?: string
  payment_schedule?: Array<Record<string, unknown>>
  tc_name?: string
  terms?: string
  items: PurchaseInvoiceItemForm[]
  taxes: PurchaseInvoiceTaxFormRow[]
  total_qty?: number
  total?: number
  net_total?: number
  total_taxes_and_charges?: number
  grand_total?: number
  rounded_total?: number
  discount_amount?: number
  outstanding_amount?: number
  paid_amount?: number
  purchase_order?: string
  docstatus: number
  status?: string
}

export interface PurchaseInvoiceListFilters {
  search?: string
  page?: number
  pageLength?: number
  pageSize?: number
  start?: number
  status?: string
  supplier?: string
  company?: string
  postingDateFrom?: string
  postingDateTo?: string
  dueDateFrom?: string
  dueDateTo?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
  filters?: unknown[][]
}

/** Full ERPNext doc shape as saved/returned by the REST API. */
export interface PurchaseInvoiceDoc {
  doctype: "Purchase Invoice"
  name: string
  naming_series?: string
  supplier: string
  supplier_name: string
  posting_date: string
  due_date: string
  company: string
  currency: string
  conversion_rate: number
  price_list_currency?: string
  total_qty: number
  net_total: number
  total_net: number
  total_taxes_and_charges: number
  grand_total: number
  rounded_total: number
  outstanding_amount: number
  paid_amount: number
  status: string
  docstatus: 0 | 1 | 2
  items: PurchaseInvoiceItemDoc[]
  taxes: PurchaseInvoiceTaxDoc[]
  payment_schedule?: Array<Record<string, unknown>>
  advance_paid?: number
  owner?: string
  creation?: string
  modified?: string
  modified_by?: string
  amended_from?: string | null
  set_warehouse?: string
  cost_center?: string
  project?: string
  purchase_order?: string
}

export interface PurchaseInvoiceItemDoc {
  doctype: "Purchase Invoice Item"
  name?: string
  item_code: string
  item_name?: string
  description?: string
  qty: number
  rate: number
  amount: number
  uom?: string
  conversion_factor?: number
  warehouse?: string
  cost_center?: string
  project?: string
  expense_account?: string
  purchase_order?: string
  purchase_order_item?: string
  parentfield: "items"
  parenttype: "Purchase Invoice"
  parent?: string
}

export interface PurchaseInvoiceTaxDoc {
  doctype: "Purchase Taxes and Charges"
  name?: string
  charge_type: string
  account_head: string
  description?: string
  rate: number
  tax_amount: number
  total: number
  parentfield: "taxes"
  parenttype: "Purchase Invoice"
  parent?: string
}

/** Unsaved pre-filled doc returned by the PO → PI mapper. */
export interface MappedPurchaseInvoice {
  doctype: "Purchase Invoice"
  supplier: string
  supplier_name: string
  company: string
  currency: string
  posting_date: string
  due_date?: string
  items: PurchaseInvoiceItemDoc[]
  taxes: PurchaseInvoiceTaxDoc[]
}