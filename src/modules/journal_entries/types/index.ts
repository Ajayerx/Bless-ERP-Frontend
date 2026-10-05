import type {
  JournalEntryAccountRow as JournalEntryAccountDocRow,
  JournalEntryDoc,
} from "@/services/journal-entry.service"

export type { JournalEntryAccountDocRow, JournalEntryDoc }

export type JournalEntryStatus = "draft" | "submitted" | "cancelled"

/** ERPNext Journal Entry list-row projection (M3.6 parity columns). */
export interface JournalEntryRow {
  id: string
  number: string
  title: string
  posting_date: string
  voucher_type: string
  reference: string // bill_no
  company: string
  status: JournalEntryStatus
  docstatus: number
  total_debit: number
  total_credit: number
  createdAt: string
}

export interface JournalEntryListResponse {
  items: JournalEntryRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** Accounts child-table row as edited by the form (local grid key). */
export interface JournalEntryAccountFormRow {
  key: string
  account: string
  party_type: string
  party: string
  account_currency: string
  exchange_rate: number
  debit: number
  credit: number
  cost_center: string
  project: string
}

export interface JournalEntryFormData {
  doctype: "Journal Entry"
  name?: string
  naming_series: string
  voucher_type: string
  posting_date: string
  company: string
  finance_book: string
  bill_no: string
  is_opening: 0 | 1
  multi_currency: 0 | 1
  remark: string
  user_remark: string
  title: string
  accounts: JournalEntryAccountFormRow[]
  total_debit: number
  total_credit: number
  difference: number
  docstatus: number
}