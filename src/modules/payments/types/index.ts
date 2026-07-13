export interface PaymentEntryReference {
  name?: string
  reference_doctype: string
  reference_name: string
  total_amount: number
  outstanding_amount: number
  allocated_amount: number
  exchange_rate?: number
  exchange_gain_loss?: number
}

export interface PaymentEntryDeduction {
  name?: string
  account: string
  cost_center?: string
  amount: number
  description?: string
}

export interface PaymentEntryTax {
  name?: string
  charge_type: string
  account_head: string
  description?: string
  rate: number
  tax_amount?: number
  total?: number
}

export interface PaymentEntry {
  name: string
  payment_type: string
  posting_date: string
  company: string
  party_type: string
  party: string
  party_name?: string
  party_balance?: number
  paid_from: string
  paid_from_account_currency: string
  paid_amount: number
  paid_amount_after_tax?: number
  paid_to: string
  paid_to_account_currency: string
  received_amount: number
  received_amount_after_tax?: number
  base_paid_amount?: number
  base_received_amount?: number
  total_allocated_amount?: number
  unallocated_amount?: number
  difference_amount?: number
  source_exchange_rate: number
  target_exchange_rate: number
  bank_account?: string
  party_bank_account?: string
  contact_person?: string
  contact_email?: string
  reference_no?: string
  reference_date?: string
  remarks?: string
  mode_of_payment?: string
  status: string
  docstatus: number
  references?: PaymentEntryReference[]
  deductions?: PaymentEntryDeduction[]
  taxes?: PaymentEntryTax[]
  amended_from?: string
}

export interface PaymentEntryListResponse {
  items: PaymentEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type PaymentMethod =
  | "cash"
  | "interac"
  | "e_transfer"
  | "check"
  | "bank_transfer"
  | "credit_card"
  | "on_account"

export const PAYMENT_METHOD_MAP: Record<PaymentMethod, string> = {
  cash: "Cash",
  interac: "Interac",
  e_transfer: "Bank Transfer",
  check: "Cheque",
  bank_transfer: "Bank Transfer",
  credit_card: "Credit Card",
  on_account: "Credit Card",
}

export const MOP_TO_ERP: Record<PaymentMethod, string> = {
  cash: "Cash",
  interac: "Wire Transfer",
  e_transfer: "Wire Transfer",
  check: "Cheque",
  bank_transfer: "Wire Transfer",
  credit_card: "Credit Card",
  on_account: "Credit Card",
}

export interface InvoiceAllocation {
  name: string
  customer_name: string
  grand_total: number
  outstanding_amount: number
  allocated_amount: number
}

export interface PaymentDeductionForm {
  id: string
  account: string
  amount: number
  description: string
}

export interface RecordPaymentData {
  paymentType: "Receive" | "Pay" | "Internal Transfer"
  partyType: string
  party: string
  partyName: string
  amount: number
  paymentDate: string
  paymentMethod: PaymentMethod
  reference: string
  notes: string
  bankAccount?: string
  paidFromOverride?: string
  paidToOverride?: string
  partyBankAccount?: string
  contactPerson?: string
  contactEmail?: string
  sourceExchangeRate?: number
  allocations: InvoiceAllocation[]
  deductions: PaymentDeductionForm[]
}
