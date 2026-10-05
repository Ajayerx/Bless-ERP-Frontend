export interface BankAccount {
  name: string
  account_name: string
  account?: string
  bank: string
  account_type?: string
  account_subtype?: string
  is_default?: number | boolean
  is_company_account?: number | boolean
  company?: string
  party_type?: string
  party?: string
  iban?: string
  bank_account_no?: string
  branch_code?: string
  disabled?: number | boolean
  integration_id?: string
  last_integration_date?: string
  mask?: string
  creation?: string
  modified?: string
}

export interface BankAccountListResponse {
  items: BankAccount[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface BankAccountFormData {
  account_name: string
  bank: string
  is_company_account: boolean
  company: string
  account: string
  account_type: string
  account_subtype: string
  party_type: string
  party: string
  is_default: boolean
  iban: string
  bank_account_no: string
  branch_code: string
  disabled: boolean
  last_integration_date: string
}

export interface BankAccountListFilters {
  search?: string
  page?: number
  pageSize?: number
  pageLength?: number
  start?: number
  status?: "enabled" | "disabled"
  filters?: unknown[][]
  sortBy?: string
  sortOrder?: "asc" | "desc"
}