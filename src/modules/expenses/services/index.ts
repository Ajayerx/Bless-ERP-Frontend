import { apiClient } from "@/services/api-client"
import type { Expense, ExpenseListResponse, ExpenseFormData } from "../types"
export type { Expense, ExpenseListResponse, ExpenseFormData }

export const expenseService = {
  list: (params: { search?: string; page?: number; pageSize?: number; category?: string }): Promise<ExpenseListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    if (params.category) qs.set("category", params.category)
    return apiClient(`/expenses?${qs}`)
  },
  getById: (id: string): Promise<Expense> => apiClient(`/expenses/${id}`),
  create: (data: ExpenseFormData): Promise<Expense> =>
    apiClient("/expenses", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ExpenseFormData>): Promise<Expense> =>
    apiClient(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
}
