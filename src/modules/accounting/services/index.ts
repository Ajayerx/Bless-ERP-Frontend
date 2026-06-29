import { apiClient } from "@/services/api-client"
import type {
  Expense, ExpenseListResponse, ExpenseFormData,
  TaxSummaryData,
  BankAccount, BankAccountListResponse, BankAccountFormData,
  JournalEntry, JournalEntryListResponse, JournalEntryFormData,
} from "../types"

export const accountingService = {
  // --- Expenses ---
  async listExpenses(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<ExpenseListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<ExpenseListResponse>(`/expenses?${qs.toString()}`)
  },

  async getExpense(id: string): Promise<Expense> {
    return apiClient<Expense>(`/expenses/${id}`)
  },

  async createExpense(data: ExpenseFormData): Promise<Expense> {
    return apiClient<Expense>("/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateExpense(id: string, data: Partial<ExpenseFormData>): Promise<Expense> {
    return apiClient<Expense>(`/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  // --- Tax Summary ---
  async getTaxSummary(): Promise<TaxSummaryData> {
    return apiClient<TaxSummaryData>("/accounting/tax-summary")
  },

  // --- Bank Accounts ---
  async listBankAccounts(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<BankAccountListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<BankAccountListResponse>(`/bank-accounts?${qs.toString()}`)
  },

  async getBankAccount(id: string): Promise<BankAccount> {
    return apiClient<BankAccount>(`/bank-accounts/${id}`)
  },

  async createBankAccount(data: BankAccountFormData): Promise<BankAccount> {
    return apiClient<BankAccount>("/bank-accounts", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateBankAccount(id: string, data: Partial<BankAccountFormData>): Promise<BankAccount> {
    return apiClient<BankAccount>(`/bank-accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  // --- Journal Entries ---
  async listJournalEntries(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<JournalEntryListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<JournalEntryListResponse>(`/journal-entries?${qs.toString()}`)
  },

  async getJournalEntry(id: string): Promise<JournalEntry> {
    return apiClient<JournalEntry>(`/journal-entries/${id}`)
  },

  async createJournalEntry(data: JournalEntryFormData): Promise<JournalEntry> {
    return apiClient<JournalEntry>("/journal-entries", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateJournalEntry(id: string, data: Partial<JournalEntryFormData & { status: JournalEntry["status"] }>): Promise<JournalEntry> {
    return apiClient<JournalEntry>(`/journal-entries/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
}
