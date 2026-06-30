import { apiClient } from "./api-client"

export interface Expense {
  id: string
  category: string
  amount: number
  date: string
  supplier: string
  description: string
  paymentMethod: string
  status: "paid" | "unpaid"
  notes: string
  createdAt: string
}

export interface ExpenseListResponse {
  items: Expense[]
  total: number
  page: number
  pageSize: number
}

export interface ExpenseFormData {
  category: string
  amount: number
  date: string
  supplier: string
  description: string
  paymentMethod: string
  notes: string
}

interface ExpenseService {
  list(params: { search?: string; page?: number; pageSize?: number; category?: string }): Promise<ExpenseListResponse>
  getById(id: string): Promise<Expense>
  create(data: ExpenseFormData): Promise<Expense>
}

export const expenseService: ExpenseService = {
  list: (params) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    if (params.category) qs.set("category", params.category)
    return apiClient(`/expenses?${qs}`)
  },
  getById: (id) => apiClient(`/expenses/${id}`),
  create: (data) =>
    apiClient("/expenses", { method: "POST", body: JSON.stringify(data) }),
}
