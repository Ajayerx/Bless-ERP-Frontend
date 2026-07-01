import { apiClient } from "./api-client"

export type BankAccountType = "chequing" | "savings" | "credit"

export interface BankAccount {
  id: string
  name: string
  accountNumber: string
  type: BankAccountType
  balance: number
  currency: string
  institution: string
  isDefault: boolean
  createdAt: string
}

export interface BankAccountListResponse {
  items: BankAccount[]
  total: number
}

export interface BankAccountFormData {
  name: string
  accountNumber: string
  type: BankAccountType
  balance: number
  currency: string
  institution: string
  isDefault: boolean
}

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
