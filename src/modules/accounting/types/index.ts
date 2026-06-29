export type ExpenseStatus = "draft" | "paid" | "pending"
export type BankAccountType = "checking" | "savings" | "credit"
export type AccountStatus = "active" | "inactive"
export type JournalEntryStatus = "draft" | "posted"

export interface Expense {
  id: string
  number: string
  vendorName: string
  category: string
  amount: number
  taxAmount: number
  total: number
  status: ExpenseStatus
  description: string
  date: string
  paymentMethod: string
  notes: string
  createdAt: string
}

export interface ExpenseListResponse {
  items: Expense[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ExpenseFormData {
  vendorName: string
  category: string
  amount: number
  taxAmount: number
  total: number
  description: string
  date: string
  paymentMethod: string
  notes: string
}

export interface TaxSummaryData {
  period: string
  totalCollected: number
  totalPaid: number
  netDue: number
  gstCollected: number
  qstCollected: number
  gstPaid: number
  qstPaid: number
  breakdown: TaxBreakdownRow[]
}

export interface TaxBreakdownRow {
  id: string
  reference: string
  vendorOrCustomer: string
  date: string
  type: "sales" | "purchase"
  subtotal: number
  gst: number
  qst: number
  total: number
}

export interface BankAccount {
  id: string
  accountName: string
  accountNumber: string
  bankName: string
  branch: string
  type: BankAccountType
  balance: number
  currency: string
  status: AccountStatus
  createdAt: string
}

export interface BankAccountListResponse {
  items: BankAccount[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface BankAccountFormData {
  accountName: string
  accountNumber: string
  bankName: string
  branch: string
  type: BankAccountType
  balance: number
  currency: string
}

export interface JournalEntryLine {
  id: string
  accountName: string
  debit: number
  credit: number
}

export interface JournalEntry {
  id: string
  number: string
  date: string
  description: string
  reference: string
  lines: JournalEntryLine[]
  totalDebit: number
  totalCredit: number
  status: JournalEntryStatus
  createdAt: string
}

export interface JournalEntryListResponse {
  items: JournalEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface JournalEntryFormData {
  date: string
  description: string
  reference: string
  lines: Omit<JournalEntryLine, "id">[]
  totalDebit: number
  totalCredit: number
}
