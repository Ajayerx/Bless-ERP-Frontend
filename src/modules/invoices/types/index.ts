export interface SalesInvoiceItem {
  name?: string
  item_code: string
  item_name?: string
  description?: string
  qty: number
  uom?: string
  conversion_factor?: number
  rate: number
  amount?: number
  base_rate?: number
  base_amount?: number
  income_account?: string
  cost_center?: string
  warehouse?: string
  discount_percentage?: number
  discount_amount?: number
  margin_type?: "Percentage" | "Amount"
  margin_rate_or_amount?: number
  item_tax_template?: string
  batch_no?: string
  serial_no?: string
  enable_deferred_revenue?: boolean
  service_start_date?: string
  service_end_date?: string
  deferred_revenue_account?: string
  weight_per_unit?: number
  total_weight?: number
  grant_commission?: boolean
  page_break?: boolean
}

export interface SalesInvoiceSalesTeam {
  name?: string
  sales_person: string
  allocated_percentage?: number
  allocated_amount?: number
  commission_rate?: number
  incentives?: number
}

export interface SalesInvoiceTax {
  name?: string
  charge_type: string
  account_head: string
  description?: string
  rate: number
  tax_amount?: number
  total?: number
  included_in_print_rate?: boolean | number
  /** "Total" (default) or "Valuation"; Valuation rows are excluded from the Tax Breakup. */
  category?: string
  /** ERPNext/erpnext stored JSON `{item_code: [rate, amount]}` in base currency. */
  item_wise_tax_detail?: string
}

export type ChargeType =
  | "Actual"
  | "On Net Total"
  | "On Previous Row Amount"
  | "On Previous Row Total"
  | "On Item Quantity"

export interface EditableTaxRow {
  charge_type: ChargeType
  account_head: string
  description: string
  rate: number
  tax_amount: number
  net_amount: number
  total: number
  tax_amount_after_discount_amount?: number
  included_in_print_rate: boolean
  row_id?: number
  /** "Total" (default) or "Valuation"; Valuation rows are excluded from the Tax Breakup. */
  category?: string
}

export interface SalesInvoicePayment {
  name?: string
  mode_of_payment: string
  amount: number
  account?: string
  type?: string
  base_amount?: number
}

export interface SalesInvoiceAdvance {
  name?: string
  reference_type: string
  reference_name: string
  reference_row?: string
  advance_amount: number
  allocated_amount: number
  exchange_gain_loss?: number
  ref_exchange_rate?: number
  difference_posting_date?: string
  account?: string
  remarks?: string
}

export interface SalesInvoice {
  name: string
  title?: string
  customer: string
  customer_name: string
  company: string
  posting_date: string
  due_date: string
  posting_time?: string
  currency: string
  conversion_rate?: number
  selling_price_list?: string
  price_list_currency?: string
  plc_conversion_rate?: number
  ignore_pricing_rule?: boolean
  set_warehouse?: string
  set_target_warehouse?: string
  update_stock?: number
  net_total: number
  total_taxes_and_charges: number
  grand_total: number
  rounded_total?: number
  outstanding_amount: number
  in_words?: string
  status: string
  docstatus: number
  taxes_and_charges?: string
  /** ERPNext/erpnext stores the pre-rendered "Tax Breakup" HTML here (itemised_tax_breakup.html). */
  other_charges_calculation?: string
  tax_category?: string
  customer_address?: string
  address_display?: string
  shipping_address_name?: string
  shipping_address?: string
  contact_person?: string
  contact_email?: string
  contact_mobile?: string
  contact_phone?: string
  contact_designation?: string
  contact_department?: string
  po_no?: string
  po_date?: string
  payment_terms_template?: string
  apply_discount_on?: "Grand Total" | "Net Total"
  discount_amount?: number
  additional_discount_percentage?: number
  coupon_code?: string
  additional_discount_account?: string
  is_cash_or_non_trade_discount?: boolean
  disable_rounded_total?: boolean
  use_company_roundoff_cost_center?: boolean
  write_off_amount?: number
  write_off_account?: string
  write_off_cost_center?: string
  write_off_outstanding_amount_automatically?: boolean
  cost_center?: string
  project?: string
  debit_to?: string
  party_account_currency?: string
  // Sales Team
  sales_partner?: string
  commission_rate?: number
  total_commission?: number
  sales_team?: SalesInvoiceSalesTeam[]
  // Loyalty
  redeem_loyalty_points?: boolean
  loyalty_program?: string
  loyalty_points?: number
  loyalty_amount?: number
  loyalty_redemption_account?: string
  loyalty_redemption_cost_center?: string
  // Print
  letter_head?: string
  group_same_items?: boolean
  select_print_heading?: string
  language?: string
  // Terms
  tc_name?: string
  terms?: string
  // Returns
  is_return?: boolean
  return_against?: string
  is_debit_note?: boolean
  update_billed_amount_in_sales_order?: boolean
  update_billed_amount_in_delivery_note?: boolean
  update_outstanding_for_self?: boolean
  is_opening?: string
  customer_group?: string
  remarks?: string
  // Amendment
  amended_from?: string
  // Additional fetch_from / round-trip fields
  tax_id?: string
  company_tax_id?: string
  is_internal_customer?: 0 | 1
  represents_company?: string
  dispatch_address_name?: string
  dispatch_address?: string
  naming_series?: string
  set_posting_time?: boolean
  contact_display?: string
  company_address?: string
  company_address_display?: string
  // Base currency (ERPNext-computed)
  base_grand_total?: number
  base_net_total?: number
  base_total_taxes_and_charges?: number
  base_rounding_adjustment?: number
  base_rounded_total?: number
  base_in_words?: string
  total_net_weight?: number
  rounding_adjustment?: number
  base_paid_amount?: number
  paid_amount?: number
  base_change_amount?: number
  change_amount?: number
  base_write_off_amount?: number
  total_advance?: number
  // Accounting Details
  unrealized_profit_loss_account?: string
  against_income_account?: string
  // Additional
  tax_withholding_category?: string
  // Advances
  advances?: SalesInvoiceAdvance[]
  allocate_advances_automatically?: boolean
  only_include_allocated_payments?: boolean
  // POS
  is_pos?: boolean
  pos_profile?: string
  account_for_change_amount?: string
  // Subscription
  subscription?: string
  from_date?: string
  to_date?: string
  auto_repeat?: string
  items: SalesInvoiceItem[]
  taxes?: SalesInvoiceTax[]
  payments?: SalesInvoicePayment[]
  payment_schedule?: Array<{
    payment_term?: string
    description?: string
    due_date: string
    invoice_portion?: number
    payment_amount: number
    outstanding: number
  }>
  creation?: string
  modified?: string
  owner?: string
  modified_by?: string
}

export interface SalesInvoiceFormData {
  customer: string
  company: string
  posting_date: string
  due_date: string
  posting_time?: string
  naming_series?: string
  set_posting_time?: boolean
  currency?: string
  conversion_rate?: number
  selling_price_list?: string
  price_list_currency?: string
  plc_conversion_rate?: number
  ignore_pricing_rule?: boolean
  set_warehouse?: string
  set_target_warehouse?: string
  update_stock?: boolean
  debit_to?: string
  party_account_currency?: string
  taxes_and_charges?: string
  tax_category?: string
  shipping_rule?: string
  incoterm?: string
  named_place?: string
  customer_address?: string
  shipping_address_name?: string
  contact_person?: string
  po_no?: string
  po_date?: string
  payment_terms_template?: string
  apply_discount_on?: "Grand Total" | "Net Total"
  discount_amount?: number
  additional_discount_percentage?: number
  coupon_code?: string
  additional_discount_account?: string
  is_cash_or_non_trade_discount?: boolean
  disable_rounded_total?: boolean
  use_company_roundoff_cost_center?: boolean
  write_off_amount?: number
  write_off_account?: string
  write_off_cost_center?: string
  write_off_outstanding_amount_automatically?: boolean
  cost_center?: string
  project?: string
  // Sales Team
  sales_partner?: string
  commission_rate?: number
  total_commission?: number
  sales_team?: SalesInvoiceSalesTeam[]
  // Loyalty
  redeem_loyalty_points?: boolean
  loyalty_program?: string
  loyalty_points?: number
  loyalty_amount?: number
  loyalty_redemption_account?: string
  loyalty_redemption_cost_center?: string
  // Print
  letter_head?: string
  group_same_items?: boolean
  select_print_heading?: string
  language?: string
  // Terms
  tc_name?: string
  terms?: string
  // Returns
  is_return?: boolean
  return_against?: string
  is_debit_note?: boolean
  update_billed_amount_in_sales_order?: boolean
  update_billed_amount_in_delivery_note?: boolean
  update_outstanding_for_self?: boolean
  // Advances
  advances?: SalesInvoiceAdvance[]
  allocate_advances_automatically?: boolean
  only_include_allocated_payments?: boolean
  // POS
  is_pos?: boolean
  pos_profile?: string
  account_for_change_amount?: string
  cash_bank_account?: string
  // Subscription
  subscription?: string
  from_date?: string
  to_date?: string
  auto_repeat?: string
  is_opening?: string
  customer_group?: string
  remarks?: string
  campaign?: string
  source?: string
  // Address & Contact (new fields)
  dispatch_address_name?: string
  company_address?: string
  company_contact_person?: string
  territory?: string
  tax_id?: string
  company_tax_id?: string
  // Accounting Details (new fields)
  unrealized_profit_loss_account?: string
  against_income_account?: string
  // Additional Info
  title?: string
  status?: string
  taxWithholdingCategory?: string
  is_internal_customer?: boolean
  represents_company?: string
  inter_company_invoice_reference?: string
  is_discounted?: boolean
  // UTM Analytics
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  // Payments (computed display)
  base_paid_amount?: number
  paid_amount?: number
  base_change_amount?: number
  change_amount?: number
  base_write_off_amount?: number
  items: Omit<SalesInvoiceItem, "name" | "amount">[]
  taxes?: SalesInvoiceTax[]
  payments?: SalesInvoicePayment[]
  payment_schedule?: Array<{
    payment_term?: string
    description?: string
    due_date: string
    invoice_portion?: number
    payment_amount: number
  }>
}

export interface SalesInvoiceListResponse {
  items: SalesInvoice[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}