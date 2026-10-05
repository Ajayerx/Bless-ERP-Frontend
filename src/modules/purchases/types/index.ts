/**
 * Purchase Order domain types.
 *
 * `PurchaseOrder` is the light list/detail row backed by `/api/resource/Purchase Order`
 * ERPNext fields. `PurchaseOrderDoc` mirrors the ERPNext `Purchase Order` doctype for
 * the full create/edit forms.
 */

export type PurchaseOrderDocStatus = 0 | 1 | 2

export type PurchaseOrderStatus =
  | "Draft"
  | "On Hold"
  | "To Receive and Bill"
  | "To Receive"
  | "To Bill"
  | "Completed"
  | "Cancelled"
  | "Closed"

export type PurchaseOrderIndicatorLabel =
  | "Draft"
  | "Cancelled"
  | "Submitted"
  | "On Hold"
  | "Closed"
  | "Completed"
  | "To Receive"
  | "To Receive and Bill"
  | "To Bill"

export type PurchaseOrderIndicatorVariant = "success" | "warning" | "danger" | "info"

export interface PurchaseOrderItem {
  productId: string
  productName: string
  qty: number
  rate: number
  amount: number
}

export interface PurchaseOrder {
  id: string
  /** ERPNext document name (e.g. "PUR-ORD-2026-00001") — syncs with `id`. */
  name: string
  number: string
  supplierId: string
  supplierName: string
  issueDate: string
  scheduleDate: string
  /** Simplified badge status (kept for existing consumers). */
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled"
  /** Raw ERPNext status literal (Draft / On Hold / To Receive and Bill / …). */
  rawStatus: PurchaseOrderStatus
  /** Full derived indicator label used by the list/status chips. */
  indicator: PurchaseOrderIndicatorLabel
  /** Docstatus drives list actions: 0 draft, 1 submitted, 2 cancelled. */
  docstatus: PurchaseOrderDocStatus
  items: PurchaseOrderItem[]
  total: number
  company?: string
  currency?: string
  perReceived?: number
  perBilled?: number
  accumulationStatus: "pending" | "partial" | "received" | "cancelled"
  createdAt: string
  modified?: string
}

export interface PurchaseOrderListResponse {
  items: PurchaseOrder[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PurchaseOrderItemForm {
  name?: string
  item_code?: string
  item_name: string
  description?: string
  item_group?: string
  brand?: string
  image?: string
  idx?: number
  uom: string
  conversion_factor: number
  stock_uom?: string
  stock_qty?: number
  stock_uom_rate?: number
  actual_qty?: number
  projected_qty?: number
  received_qty?: number
  returned_qty?: number
  billed_qty?: number
  billed_amt?: number
  qty: number
  price_list_rate: number
  rate: number
  amount: number
  base_rate?: number
  base_amount?: number
  base_net_rate?: number
  base_net_amount?: number
  net_rate?: number
  net_amount?: number
  discount_percentage: number
  discount_amount?: number
  warehouse?: string
  target_warehouse?: string
  schedule_date?: string
  from_warehouse?: string
  is_stock_item?: number
  item_tax_template?: string
  item_tax_rate?: string
  pricing_rules?: string
  expense_account?: string
  cost_center?: string
  project?: string
  manufacturing_warehouse?: string
  actual_batch_qty?: number
  batch_no?: string
  serial_no?: string
  supplier_part_no?: string
  page_break?: number
  is_free_item?: number
  weight_per_unit?: number
  weight_uom?: string
  total_weight?: number
  barcode?: string | null
}

export interface PurchaseOrderTax {
  name?: string
  charge_type: string
  account_head: string
  rate: number
  tax_amount: number
  total: number
  description?: string
  cost_center?: string
  included_in_print_rate?: number
  category?: string
  row_id?: number
  item_wise_tax_detail?: string
  idx?: number
}

export interface PurchaseOrderPaymentScheduleRow {
  name?: string
  payment_term?: string
  description?: string
  due_date?: string
  invoice_portion: number
  payment_amount: number
  base_payment_amount?: number
  due_date_based_on?: string
  credit_days?: number
  credit_months?: number
  discount_date?: string
  discount?: number
  discount_type?: string
  discount_validity?: number
  discount_validity_based_on?: string
  mode_of_payment?: string
  outstanding?: number
  paid_amount?: number
  idx?: number
}

export interface PurchaseOrderDoc {
  doctype: "Purchase Order"
  name: string
  docstatus: PurchaseOrderDocStatus
  naming_series?: string
  supplier: string
  supplier_name?: string
  tax_id?: string
  tax_category?: string
  supplier_address?: string
  address_display?: string
  supplier_group?: string
  contact_person?: string
  contact_display?: string
  contact_mobile?: string
  contact_phone?: string
  contact_email?: string
  shipping_address?: string
  shipping_address_display?: string
  shipping_contact_person?: string
  shipping_contact_display?: string
  transaction_date: string
  schedule_date: string
  company: string
  amended_from?: string
  cost_center?: string
  project?: string
  accounting_dimensions?: Record<string, string>

  currency: string
  conversion_rate: number
  buying_price_list: string
  price_list_currency?: string
  plc_conversion_rate?: number
  ignore_pricing_rule?: number

  scan_barcode?: string
  set_warehouse?: string
  set_from_warehouse?: string
  set_reserve_warehouse?: string

  items: PurchaseOrderItemForm[]
  total_qty: number
  base_total?: number
  base_net_total?: number
  total: number
  net_total: number

  taxes_and_charges?: string
  taxes: PurchaseOrderTax[]
  other_charges_calculation?: string
  base_total_taxes_and_charges: number
  total_taxes_and_charges: number
  base_grand_total: number
  base_rounding_adjustment: number
  base_rounded_total: number
  base_in_words: string
  grand_total: number
  rounding_adjustment: number
  rounded_total: number
  disable_rounded_total?: number
  in_words: string
  advance_paid?: number

  apply_discount_on?: string
  base_discount_amount?: number
  additional_discount_percentage?: number
  discount_amount?: number

  pricing_rules?: unknown[]
  receipt_creation_time?: number

  is_internal_supplier?: number
  represents_company?: string
  supplier_warehouse?: string
  inter_company_order_reference?: string

  payment_terms_template?: string
  payment_schedule: PurchaseOrderPaymentScheduleRow[]
  tc_name?: string
  terms?: string

  status: PurchaseOrderStatus
  per_received: number
  per_billed: number

  letter_head?: string
  group_same_items?: number
  select_print_heading?: string
  language?: string

  _assign?: string
  _user_tags?: string
  _comments?: string
  _liked_by?: string
  owner: string
  creation: string
  modified: string
  modified_by: string
  idx?: number
}

export type PurchaseOrderFormData = Partial<PurchaseOrderDoc>

export interface PurchaseOrderItemisedBreakupRow {
  item: string
  itemCode?: string
  itemName?: string
  taxableAmount: number
  taxes: Record<string, { taxRate: number; taxAmount: number }>
}