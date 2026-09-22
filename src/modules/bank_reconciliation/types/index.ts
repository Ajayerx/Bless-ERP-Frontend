// Types for the Bank Reconciliation Tool (mirrors ERPNext's
// bank_reconciliation_tool.js + Bank Transaction doctype).

export interface BankTransactionPaymentEntry {
  payment_document: string
  payment_entry: string
  allocated_amount: number
}

export interface BankTransaction {
  name: string
  date: string
  bank_account: string
  company: string
  currency: string
  description: string
  reference_number: string
  transaction_id: string
  transaction_type: string
  deposit: number
  withdrawal: number
  allocated_amount: number
  unallocated_amount: number
  status: "Reconciled" | "Unreconciled" | "Cancelled"
  party_type: string
  party: string
  bank_party_name: string
  bank_party_account_number: string
  bank_party_iban: string
  payment_entries: BankTransactionPaymentEntry[]
}

export interface BankReconciliationFilters {
  company: string
  bank_account: string
  from_date: string
  to_date: string
  from_reference_date: string
  to_reference_date: string
  filter_by_reference_date: boolean
  bank_statement_opening_balance: number
  bank_statement_closing_balance: number
}

export interface LinkedVoucher {
  doctype: string
  name: string
  reference_date: string
  amount: number
  remaining_amount: number
  reference_number: string
  party: string
  is_exact_match: number
}

export interface ReconcileVoucherInput {
  doctype: string
  name: string
  amount: number
}

export interface VoucherCreationResult {
  doctype: string
  name: string
}

export interface AutoReconcileResult {
  matched: number
}

export interface BankReconciliationStatement {
  closing_balance: number
}

export type ReconcileAction = "match" | "create" | "update"
export type CreateVoucherDoctype = "Payment Entry" | "Journal Entry"

// --- Bank Statement Import wizard -----------------------------------------

export interface BankStatementPreview {
  columns: string[]
  data: Array<Array<string | number | null>>
}

// file column header → Bank Transaction field
export type BankStatementMapping = Record<string, string>

export interface BankImportResult {
  success: number
  errors: number
}

export const BANK_TRANSACTION_IMPORT_FIELDS = [
  "date",
  "description",
  "deposit",
  "withdrawal",
  "reference_number",
  "transaction_id",
  "transaction_type",
  "party",
  "party_type",
  "currency",
  "bank_party_name",
  "bank_party_account_number",
  "bank_party_iban",
  "included_fee",
  "excluded_fee",
] as const

export const JOURNAL_ENTRY_TYPES = [
  "Journal Entry",
  "Inter Company Journal Entry",
  "Bank Entry",
  "Cash Entry",
  "Credit Card Entry",
  "Debit Note",
  "Credit Note",
  "Contra Entry",
  "Excise Entry",
  "Write Off Entry",
  "Opening Entry",
  "Depreciation Entry",
  "Exchange Rate Revaluation",
  "Exchange Gain Or Loss",
] as const
