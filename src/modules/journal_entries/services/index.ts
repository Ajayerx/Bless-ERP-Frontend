import { apiClient } from "@/services/api-client"
import type { JournalEntryStatus, JournalEntry, JournalEntryListResponse, JournalEntryFormData } from "../types"
export type { JournalEntryStatus, JournalEntry, JournalEntryListResponse, JournalEntryFormData }

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
