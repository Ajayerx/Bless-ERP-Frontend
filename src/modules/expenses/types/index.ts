export type ExpenseStatus = "draft" | "submitted" | "cancelled"

export interface ExpenseAccountLine {
  account: string
  partyType: string
  party: string
  debit: number
  credit: number
  costCenter: string
  project: string
}

export interface Expense {
  id: string
  name: string
  title: string
  postingDate: string
  company: string
  voucherType: string
  expenseAccount: string
  amount: number
  paidFrom: string
  supplier: string
  remark: string
  docstatus: number
  status: ExpenseStatus
  lines: ExpenseAccountLine[]
  totalDebit: number
  totalCredit: number
  createdAt: string
  modified: string
}

export interface ExpenseListResponse {
  items: Expense[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ExpenseListParams {
  search?: string
  page?: number
  pageSize?: number
  account?: string
  company?: string
  status?: ExpenseStatus | "all"
  postingDateFrom?: string
  postingDateTo?: string
  filters?: unknown[]
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export interface ExpenseFormData {
  postingDate: string
  company: string
  remark: string
  userRemark?: string
  expenseAccount: string
  amount: number
  costCenter?: string
  project?: string
  supplier?: string
  paidFrom: string
}