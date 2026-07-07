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
