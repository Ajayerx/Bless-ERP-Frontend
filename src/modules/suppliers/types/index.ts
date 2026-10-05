export type SupplierStatus = "active" | "on_hold" | "disabled"

export type SupplierHoldType = "All" | "Purchase Orders" | "Purchase Invoices" | "Payments"

export interface Supplier {
  name: string
  naming_series?: string
  supplier_name: string
  supplier_group: string
  supplier_type: string
  territory?: string
  country?: string
  company?: string
  currency?: string
  is_group: 0 | 1
  is_internal_supplier?: 0 | 1
  supplier_primary_address?: string
  supplier_primary_contact?: string
  supplier_details?: string
  website?: string
  language?: string
  maintain_same_rate?: number
  per_receivable_creation?: number
  per_billing_creation?: number
  email_id?: string
  mobile_no?: string
  first_name?: string
  last_name?: string
  tax_id?: string
  tax_category?: string
  tax_withholding_category?: string
  payment_terms?: string
  default_price_list?: string
  advance_account?: string
  on_hold: 0 | 1
  on_hold_until?: string
  hold_type?: SupplierHoldType
  disabled: 0 | 1
  default_payable_accounts?: SupplierAccountRow[]
  creation: string
  modified: string
  status: SupplierStatus
  outstanding: number
}

export interface SupplierAccountRow {
  name?: string
  company: string
  account: string
}

export interface SupplierListResponse {
  items: Supplier[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SupplierListFilters {
  search?: string
  page?: number
  pageSize?: number
  start?: number
  pageLength?: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
  status?: "all" | "on_hold" | "disabled"
  /** Raw frappe filter tuples (`[field, operator, value]` or doctype-prefixed
   * `[doctype, field, operator, value]`); AND'd together with any search. */
  filters?: unknown[][]
}

export interface SupplierAddressInput {
  address_type?: string
  address_line1: string
  address_line2?: string
  city: string
  state?: string
  country: string
  pincode?: string
}

export interface SupplierFormData {
  naming_series?: string
  supplier_name: string
  supplier_group: string
  supplier_type: string
  territory?: string
  country?: string
  currency?: string
  is_group?: boolean
  disabled?: boolean
  on_hold?: boolean
  on_hold_until?: string
  hold_type?: SupplierHoldType
  tax_withholding_category?: string
  payment_terms?: string
  advance_account?: string
  tax_id?: string
  tax_category?: string
  default_payable_accounts?: SupplierAccountRow[]
  website?: string
  email_id?: string
  contactFirstName?: string
  contactLastName?: string
  contactEmail?: string
  contactPhone?: string
  primaryAddress?: SupplierAddressInput
  existingContactName?: string
  existingPrimaryAddressName?: string
}

export interface SupplierContactDetail {
  name: string
  first_name: string
  last_name?: string
  email_id?: string
  mobile_no?: string
  is_primary_contact?: 0 | 1
}

export interface SupplierAddressDetail {
  name: string
  address_type?: string
  address_line1: string
  address_line2?: string
  city: string
  state?: string
  country: string
  pincode?: string
  is_primary_address?: 0 | 1
}

export interface SupplierDetail extends Supplier {
  addresses: SupplierAddressDetail[]
  contacts: SupplierContactDetail[]
}

export interface SupplierDashboardCounts {
  purchase_orders: number
  purchase_invoices: number
  payment_entries: number
  outstanding: number
}