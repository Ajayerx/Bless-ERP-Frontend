export interface Customer {
  name: string
  naming_series?: string
  salutation?: string
  customer_name: string
  customer_type: string
  customer_group: string
  territory: string
  gender?: string
  lead_name?: string
  opportunity_name?: string
  prospect_name?: string
  account_manager?: string
  image?: string
  default_currency?: string
  default_bank_account?: string
  default_price_list?: string
  is_internal_customer: 0 | 1
  represents_company?: string
  market_segment?: string
  industry?: string
  website?: string
  language?: string
  customer_details?: string
  customer_primary_address?: string
  primary_address?: string
  customer_primary_contact?: string
  mobile_no?: string
  email_id?: string
  first_name?: string
  last_name?: string
  tax_id?: string
  tax_category?: string
  tax_withholding_category?: string
  payment_terms?: string
  loyalty_program?: string
  loyalty_program_tier?: string
  default_sales_partner?: string
  default_commission_rate?: number
  so_required: 0 | 1
  dn_required: 0 | 1
  is_frozen: 0 | 1
  disabled: 0 | 1
  creation: string
  modified: string
  outstanding: number
  status: string
}

export interface CustomerListResponse {
  items: Customer[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AddressInput {
  address_line1: string
  address_line2?: string
  city: string
  state?: string
  country: string
  pincode?: string
}

export interface AllowedCompanyRow {
  name?: string
  company: string
}

export interface CreditLimitRow {
  name?: string
  company: string
  credit_limit: number
  bypass_credit_limit_check: 0 | 1
}

export interface PartyAccountRow {
  name?: string
  company: string
  account?: string
}

export interface SalesTeamRow {
  name?: string
  sales_person: string
  contact_no?: string
  allocated_percentage?: number
  allocated_amount?: number
  commission_rate?: string
  incentives?: number
}

export interface PortalUserRow {
  name?: string
  user: string
}

export interface SupplierNumberRow {
  name?: string
  company?: string
  supplier_number?: string
}

export interface CustomerFormData {
  naming_series?: string
  salutation?: string
  customer_name: string
  customer_type: string
  customer_group: string
  territory: string
  gender?: string
  lead_name?: string
  opportunity_name?: string
  prospect_name?: string
  account_manager?: string
  image?: string
  default_currency?: string
  default_bank_account?: string
  default_price_list?: string
  is_internal_customer?: boolean
  represents_company?: string
  market_segment?: string
  industry?: string
  website?: string
  language?: string
  customer_details?: string
  customer_primary_contact?: string
  customer_primary_address?: string
  primary_address?: string
  mobile_no?: string
  email_id?: string
  tax_id?: string
  tax_category?: string
  tax_withholding_category?: string
  payment_terms?: string
  loyalty_program?: string
  default_sales_partner?: string
  default_commission_rate?: number
  so_required?: boolean
  dn_required?: boolean
  is_frozen?: boolean
  disabled?: boolean
  contactFirstName?: string
  contactLastName?: string
  contactEmail?: string
  contactPhone?: string
  billingAddress?: AddressInput
  shippingAddress?: AddressInput
  existingContactName?: string
  existingBillingAddressName?: string
  existingShippingAddressName?: string
  companies?: AllowedCompanyRow[]
  credit_limits?: CreditLimitRow[]
  accounts?: PartyAccountRow[]
  sales_team?: SalesTeamRow[]
  portal_users?: PortalUserRow[]
  supplier_numbers?: SupplierNumberRow[]
}

export interface ContactDetail {
  name: string
  first_name: string
  last_name?: string
  email_id?: string
  mobile_no?: string
  is_primary_contact?: 0 | 1
}

export interface TransactionCounts {
  sales_orders: number
  sales_invoices: number
  opportunities: number
  issues: number
  quotations: number
  delivery_notes: number
  payment_entries: number
  bank_accounts: number
  dunnings: number
  maintenance_visits: number
  installation_notes: number
  warranty_claims: number
  projects: number
  pricing_rules: number
  subscriptions: number
}

export interface CustomerDetail extends Customer {
  transaction_counts?: TransactionCounts
  addresses: Array<{
    name: string
    address_type: string
    address_line1: string
    address_line2?: string
    city: string
    state?: string
    country: string
    pincode?: string
  }>
  contacts: ContactDetail[]
  companies: AllowedCompanyRow[]
  credit_limits: CreditLimitRow[]
  accounts: PartyAccountRow[]
  sales_team: SalesTeamRow[]
  portal_users: PortalUserRow[]
  supplier_numbers?: SupplierNumberRow[]
}