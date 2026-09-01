/**
 * Sales Order domain types.
 *
 * The light `SalesOrder` / `SalesOrderItem` / `SalesOrderListResponse` shapes
 * back the list page and search. `SalesOrderDoc` (and its children) mirror the
 * ERPNext `Sales Order` doctype 1:1 for the full form/workspace.
 */

export interface SalesOrderItem {
  productId: string
  productName: string
  qty: number
  rate: number
  amount: number
}

export interface SalesOrder {
  id: string
  number: string
  customerId: string
  customerName: string
  issueDate: string
  deliveryDate: string
  status: "draft" | "confirmed" | "completed" | "cancelled"
  items: SalesOrderItem[]
  total: number
  perDelivered?: number
  perBilled?: number
  fulfillmentStatus: "pending" | "partial" | "fulfilled" | "cancelled"
  createdAt: string
}

export interface SalesOrderListResponse {
  items: SalesOrder[]
  total: number
  page: number
  pageSize: number
}

export type SalesOrderDocStatus = 0 | 1 | 2

export type SalesOrderStatus =
  | "Draft"
  | "On Hold"
  | "To Deliver and Bill"
  | "To Bill"
  | "To Deliver"
  | "Completed"
  | "Cancelled"
  | "Closed"

export type SalesOrderOrderType = "Sales" | "Maintenance" | "Shopping Cart"

export interface SalesOrderItemForm {
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
  reserved_qty?: number
  qty: number
  price_list_rate: number
  rate: number
  amount: number
  base_rate?: number
  base_amount?: number
  discount_percentage: number
  discount_amount?: number
  margin_type?: "Percentage" | "Amount"
  margin_rate_or_amount?: number
  rate_with_margin?: number
  base_rate_with_margin?: number
  base_net_rate?: number
  warehouse?: string
  sales_warehouse?: string
  target_warehouse?: string
  transfer_warehouse?: string
  delivery_date?: string
  delivered_by_supplier: number
  supplier?: string
  against_blanket_order?: number
  blanket_order?: string
  blanket_order_rate?: number
  is_stock_item?: number
  item_tax_template?: string
  item_tax_rate?: string
  pricing_rules?: string
  income_account?: string
  cost_center?: string
  expense_account?: string
  weight_per_unit?: number
  weight_uom?: string
  total_weight?: number
  barcode?: string | null
  reserve_stock: number
  stock_reserved_qty?: number
  deliver_status?: string
  is_free_item?: number
  grant_commission?: number
  page_break?: number
  batch_no?: string
  serial_no?: string
  delivery_note?: string
  customer_item_code?: string
}

export interface SalesOrderTax {
  name?: string
  charge_type: string
  account_head: string
  rate: number
  tax_amount: number
  total: number
  description?: string
  cost_center?: string
  included_in_print_rate?: number
  /** "Total" (default) or "Valuation"; Valuation rows are excluded from the Tax Breakup. */
  category?: string
  row_id?: number
  /** ERPNext `item_wise_tax_detail` JSON: `{ item_key: [rate, baseAmount] }`. */
  item_wise_tax_detail?: string
  idx?: number
}

export interface SalesOrderPaymentScheduleRow {
  name?: string
  payment_term?: string
  description?: string
  due_date?: string
  invoice_portion: number
  payment_amount: number
  base_payment_amount?: number
  idx?: number
}

export interface SalesOrderPricingRuleRow {
  name?: string
  pricing_rule: string
  rule_applied: number
  idx?: number
}

export interface SalesOrderPackedItemRow {
  name?: string
  item_code: string
  item_name?: string
  packed_qty?: number
  qty?: number
  warehouse?: string
  actual_qty?: number
  projected_qty?: number
  idx?: number
}

export interface SalesOrderSalesTeamRow {
  name?: string
  sales_person: string
  allocated_percentage?: number
  allocated_amount?: number
  commission_rate?: number
  incentives?: number
  idx?: number
}

export interface SalesOrderDoc {
  doctype: "Sales Order"
  name: string
  docstatus: SalesOrderDocStatus
  title?: string
  naming_series?: string
  customer: string
  customer_name?: string
  tax_id?: string
  tax_category?: string
  order_type: SalesOrderOrderType
  transaction_date: string
  delivery_date: string
  po_no?: string
  po_date?: string
  company: string
  skip_delivery_note: number
  has_unit_price_items?: number
  amended_from?: string
  cost_center?: string
  project?: string

  currency: string
  conversion_rate: number
  selling_price_list: string
  price_list_currency: string
  plc_conversion_rate: number
  ignore_pricing_rule?: number

  scan_barcode?: string
  last_scanned_warehouse?: string
  set_warehouse?: string
  reserve_stock: number

  items: SalesOrderItemForm[]
  total_qty: number
  total_net_weight?: number
  base_total: number
  base_net_total: number
  total: number
  net_total: number

  taxes_and_charges?: string
  taxes: SalesOrderTax[]
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
  margin_rate?: number

  apply_discount_on?: string
  base_discount_amount?: number
  coupon_code?: string
  additional_discount_percentage?: number
  discount_amount?: number

  packed_items: SalesOrderPackedItemRow[]
  pricing_rules: SalesOrderPricingRuleRow[]

  customer_address?: string
  address_display?: string
  customer_group?: string
  territory?: string
  contact_person?: string
  contact_display?: string
  contact_mobile?: string
  contact_phone?: string
  contact_email?: string
  shipping_address_name?: string
  shipping_address?: string
  dispatch_address_name?: string
  dispatch_address?: string
  company_address?: string
  company_address_display?: string
  company_contact_person?: string

  shipping_rule?: string
  incoterm?: string
  named_place?: string
  shipment_address?: string

  payment_terms_template?: string
  payment_schedule: SalesOrderPaymentScheduleRow[]
  tc_name?: string
  terms?: string

  status: SalesOrderStatus
  delivery_status?: string
  billing_status?: string
  per_delivered: number
  per_billed: number
  per_picked?: number

  sales_partner?: string
  amount_eligible_for_commission?: number
  commission_rate?: number
  total_commission?: number
  sales_team: SalesOrderSalesTeamRow[]

  loyalty_points?: number
  loyalty_amount?: number

  from_date?: string
  to_date?: string
  auto_repeat?: string
  update_auto_repeat_reference?: number

  letter_head?: string
  group_same_items?: number
  select_print_heading?: string
  language?: string

  is_internal_customer?: number
  represents_company?: string
  ignore_default_payment_terms_template?: number
  source?: string
  inter_company_order_reference?: string
  campaign?: string
  party_account_currency?: string

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

// Doc returned by frappe.model.mapper.make_mapped_doc (e.g. mapping a
// submitted Quotation → Sales Order). The mapped doc is UNSAVED and has no
// server name until the user saves the new form — mirroring ERPNext's
// open_mapped_doc flow, which opens a new prefilled editable form.
export type SalesOrderMappedDoc = Partial<SalesOrderDoc> & {
  doctype: "Sales Order"
  name?: string
}

export type SalesOrderFormData = Partial<SalesOrderDoc>

export interface SalesOrderItemisedBreakupRow {
  item: string
  itemCode?: string
  itemName?: string
  taxableAmount: number
  taxes: Record<string, { taxRate: number; taxAmount: number }>
}