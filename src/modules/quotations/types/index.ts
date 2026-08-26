export type QuotationDocStatus = 0 | 1 | 2

export type QuotationStatus =
  | "Draft"
  | "Open"
  | "Replied"
  | "Partially Ordered"
  | "Ordered"
  | "Lost"
  | "Cancelled"
  | "Expired"

export type QuotationTo = "Customer" | "Lead" | "Prospect"

export interface QuotationItem {
  name?: string
  item_code?: string
  item_name: string
  cost_center?: string
  qty: number
  stock_uom?: string
  stock_qty?: number
  uom: string
  conversion_factor: number
  price_list_rate: number
  rate: number
  amount: number
  discount_percentage: number
  discount_amount?: number
  margin_type?: string
  margin_rate_or_amount?: number
  base_net_rate?: number
  item_tax_template?: string
  item_tax_rate?: string
  barcode?: string | null
  pricing_rules?: string
  weight_per_unit?: number
  weight_uom?: string
  total_weight?: number
  item_group?: string
  brand?: string
  description?: string
  image?: string
  actual_qty?: number
  projected_qty?: number
  reserved_qty?: number
  is_free_item: number
  is_alternative: number
  has_alternative_item: number
  alternative_item?: string
  delivery_date?: string
  warehouse?: string
  customer_item_code?: string
  income_account?: string
  expense_account?: string
  base_rate?: number
  base_amount?: number
  grant_commission?: number
  page_break?: number
  idx?: number
}

export interface QuotationTax {
  name?: string
  charge_type: string
  account_head: string
  rate: number
  tax_amount: number
  total: number
  description?: string
  cost_center?: string
  included_in_print_rate?: number
  idx?: number
}

export interface PaymentScheduleRow {
  name?: string
  payment_term?: string
  description?: string
  due_date?: string
  invoice_portion: number
  payment_amount: number
  base_payment_amount?: number
  idx?: number
}

export interface PricingRuleRow {
  name?: string
  pricing_rule: string
  rule_applied: number
  idx?: number
}

export interface LostReasonRow {
  name?: string
  lost_reason?: string
  idx?: number
}

export interface CompetitorRow {
  name?: string
  competitor: string
  idx?: number
}

export interface Quotation {
  doctype: "Quotation"
  name: string
  title?: string
  naming_series?: string
  quotation_to: QuotationTo
  party_name: string
  customer_name?: string
  transaction_date: string
  valid_till: string
  order_type: string
  company: string
  amended_from?: string
  status: QuotationStatus
  docstatus: QuotationDocStatus
  customer_group?: string
  crm_deal?: string
  territory?: string

  scan_barcode?: string
  last_scanned_warehouse?: string

  currency: string
  conversion_rate: number
  selling_price_list: string
  price_list_currency: string
  plc_conversion_rate: number

  items: QuotationItem[]
  total_qty: number
  total_net_weight?: number
  base_total: number
  base_net_total: number
  total: number
  net_total: number
  base_total_taxes_and_charges: number
  total_taxes_and_charges: number
  base_grand_total: number
  base_rounding_adjustment: number
  base_rounded_total: number
  base_in_words: string
  grand_total: number
  rounding_adjustment: number
  rounded_total: number
  disable_rounded_total: number
  in_words: string

  tax_category?: string
  taxes_and_charges?: string
  taxes: QuotationTax[]
  shipping_rule?: string
  incoterm?: string
  named_place?: string

  apply_discount_on?: string
  coupon_code?: string
  referral_sales_partner?: string
  base_discount_amount?: number
  additional_discount_percentage?: number
  discount_amount?: number
  ignore_pricing_rule?: number

  customer_address?: string
  address_display?: string
  contact_person?: string
  contact_display?: string
  contact_mobile?: string
  contact_email?: string
  shipping_address_name?: string
  shipping_address?: string
  company_address?: string
  company_address_display?: string
  company_contact_person?: string

  payment_terms_template?: string
  payment_schedule: PaymentScheduleRow[]
  tc_name?: string
  terms?: string

  letter_head?: string
  group_same_items: number
  select_print_heading?: string
  language?: string
  lost_reasons: LostReasonRow[]
  competitors: CompetitorRow[]
  order_lost_reason?: string
  campaign?: string
  source?: string
  opportunity?: string
  supplier_quotation?: string

  pricing_rules: PricingRuleRow[]

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

export type QuotationFormData = Partial<Quotation>

export interface QuotationListResponse {
  items: Quotation[]
  total: number
  page: number
  pageSize: number
}