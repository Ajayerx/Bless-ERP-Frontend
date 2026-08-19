import { apiClient } from "@/services/api-client"
import type { BankAccountType, BankAccount, BankAccountListResponse, BankAccountFormData } from "../types"
export type { BankAccountType, BankAccount, BankAccountListResponse, BankAccountFormData }

export const bankAccountService = {
  list: (params: { search?: string; page?: number } = {}): Promise<BankAccountListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    return apiClient(`/bank-accounts?${qs}`)
  },

  getById: (id: string): Promise<BankAccount> => {
    return apiClient(`/bank-accounts/${id}`)
  },

  create: (data: BankAccountFormData): Promise<BankAccount> => {
    return apiClient("/bank-accounts", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (id: string, data: Partial<BankAccountFormData>): Promise<BankAccount> => {
    return apiClient(`/bank-accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (id: string): Promise<void> => {
    return apiClient(`/bank-accounts/${id}`, { method: "DELETE" })
  },
}
