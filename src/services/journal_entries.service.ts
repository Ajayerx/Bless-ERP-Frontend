import { apiClient } from "./api-client"

export type JournalEntryStatus = "draft" | "posted"

export interface JournalEntry {
  id: string
  number: string
  date: string
  description: string
  debit: number
  credit: number
  account: string
  counterAccount: string
  status: JournalEntryStatus
  createdAt: string
}

export interface JournalEntryListResponse {
  items: JournalEntry[]
  total: number
  page: number
  pageSize: number
}

export interface JournalEntryFormData {
  date: string
  description: string
  debit: number
  credit: number
  account: string
  counterAccount: string
  status: JournalEntryStatus
}

export const journalEntryService = {
  list: (params: { search?: string; page?: number; pageSize?: number } = {}): Promise<JournalEntryListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient(`/journal-entries?${qs}`)
  },

  getById: (id: string): Promise<JournalEntry> => {
    return apiClient(`/journal-entries/${id}`)
  },

  create: (data: JournalEntryFormData): Promise<JournalEntry> => {
    return apiClient("/journal-entries", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (id: string, data: Partial<JournalEntryFormData>): Promise<JournalEntry> => {
    return apiClient(`/journal-entries/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (id: string): Promise<void> => {
    return apiClient(`/journal-entries/${id}`, { method: "DELETE" })
  },
}
