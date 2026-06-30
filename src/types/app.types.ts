export type SortDirection = "asc" | "desc"

export interface PaginationParams {
  page?: number
  pageSize?: number
  search?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type InvoiceStatus = "paid" | "sent" | "overdue" | "draft" | "cancelled"
export type PaymentMethod = "cash" | "interac" | "e_transfer" | "check" | "bank_transfer" | "credit_card" | "on_account"
export type CustomerStatus = "active" | "inactive"
export type EntityStatus = "active" | "inactive"

export type ReportTab = "sales-summary" | "stock-report" | "tax-summary"
