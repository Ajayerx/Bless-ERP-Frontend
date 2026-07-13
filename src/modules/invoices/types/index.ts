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
  included_in_print_rate?: number
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
  set_warehouse?: string
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
  tax_category?: string
  customer_address?: string
  shipping_address_name?: string
  contact_person?: string
  contact_email?: string
  contact_mobile?: string
  po_no?: string
  po_date?: string
  payment_terms_template?: string
  apply_discount_on?: "Grand Total" | "Net Total"
  discount_amount?: number
  additional_discount_percentage?: number
  coupon_code?: string
  additional_discount_account?: string
  write_off_amount?: number
  write_off_account?: string
  write_off_cost_center?: string
  cost_center?: string
  project?: string
  debit_to?: string
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
  redemption_account?: string
  redemption_cost_center?: string
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
  is_opening?: string
  customer_group?: string
  remarks?: string
  // Amendment
  amended_from?: string
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
    due_date: string
    payment_amount: number
    outstanding: number
  }>
  creation?: string
  modified?: string
}

export interface SalesInvoiceFormData {
  customer: string
  company: string
  posting_date: string
  due_date: string
  posting_time?: string
  currency?: string
  conversion_rate?: number
  selling_price_list?: string
  price_list_currency?: string
  plc_conversion_rate?: number
  set_warehouse?: string
  update_stock?: boolean
  debit_to?: string
  taxes_and_charges?: string
  tax_category?: string
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
  write_off_amount?: number
  write_off_account?: string
  write_off_cost_center?: string
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
  redemption_account?: string
  redemption_cost_center?: string
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
  isOpening?: string
  customerGroup?: string
  remarks?: string
  items: Omit<SalesInvoiceItem, "name" | "amount">[]
}

export interface SalesInvoiceListResponse {
  items: SalesInvoice[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
