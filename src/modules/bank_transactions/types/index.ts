// Types for the Bank Transaction doctype (mirrors
// erpnext/accounts/doctype/bank_transaction/bank_transaction.json + list.js).

export type BankTransactionStatus =
  | "Pending"
  | "Settled"
  | "Unreconciled"
  | "Reconciled"
  | "Cancelled"

export interface BankTransactionPaymentEntry {
  payment_document: string
  payment_entry: string
  allocated_amount: number
}

export interface BankTransactionDoc {
  name: string
  date: string
  status: BankTransactionStatus
  docstatus: 0 | 1 | 2
  bank_account: string
  company: string
  currency: string
  deposit: number
  withdrawal: number
  description: string
  reference_number: string
  transaction_id: string
  transaction_type: string
  allocated_amount: number
  unallocated_amount: number
  party_type: string
  party: string
  bank_party_name: string
  bank_party_account_number: string
  bank_party_iban: string
  included_fee: number
  excluded_fee: number
  payment_entries: BankTransactionPaymentEntry[]
}

export interface BankTransactionListFilters {
  status: string
  bank_account: string
  search: string
}

// ERPNext list indicator: Cancelled (red) / Reconciled (green) /
// Unreconciled (orange) — bank_transaction_list.js.
export type IndicatorTone = "success" | "warning" | "danger"

export function statusIndicator(doc: BankTransactionDoc): {
  label: string
  tone: IndicatorTone
} {
  if (doc.docstatus === 2) return { label: "Cancelled", tone: "danger" }
  if (Number(doc.unallocated_amount) <= 0) return { label: "Reconciled", tone: "success" }
  return { label: "Unreconciled", tone: "warning" }
}
