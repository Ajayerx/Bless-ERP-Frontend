export interface PaymentEntryReference {
  name?: string
  reference_doctype: string
  reference_name: string
  due_date?: string
  total_amount: number
  outstanding_amount: number
  allocated_amount: number
  exchange_rate?: number
  exchange_gain_loss?: number
  bill_no?: string
  account?: string
}

export interface PaymentEntryDeduction {
  name?: string
  account: string
  cost_center: string
  amount: number
  description?: string
  is_exchange_gain_loss?: number
}

export interface PaymentEntryTax {
  name?: string
  add_deduct_tax?: string
  charge_type: string
  account_head: string
  description?: string
  rate?: number
  tax_amount?: number
  total?: number
  included_in_paid_amount?: number
  cost_center?: string
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
  mode_of_payment?: string
  paid_from: string
  paid_from_account_type?: string
  paid_from_account_currency: string
  paid_from_account_balance?: number
  paid_amount: number
  paid_amount_after_tax?: number
  base_paid_amount?: number
  base_paid_amount_after_tax?: number
  source_exchange_rate: number
  paid_to: string
  paid_to_account_type?: string
  paid_to_account_currency: string
  paid_to_account_balance?: number
  received_amount: number
  received_amount_after_tax?: number
  base_received_amount?: number
  base_received_amount_after_tax?: number
  target_exchange_rate: number
  total_allocated_amount?: number
  base_total_allocated_amount?: number
  unallocated_amount?: number
  difference_amount?: number
  bank_account?: string
  bank?: string
  bank_account_no?: string
  party_bank_account?: string
  contact_person?: string
  contact_email?: string
  reference_no?: string
  reference_date?: string
  clearance_date?: string
  remarks?: string
  custom_remarks?: number
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

export interface PartyDetails {
  party_name: string
  party_account: string
  party_account_currency: string
  party_balance: number
  party_bank_account?: string
  bank_account?: string
  contact_person?: string
  contact_email?: string
}

export interface AccountDetails {
  account_currency: string
  account_balance: number
  account_type: string
}

export interface OutstandingReference {
  voucher_type: string
  voucher_no: string
  invoice_amount: number
  outstanding_amount: number
  allocated_amount?: number
  due_date?: string
  account?: string
  exchange_rate?: number
  bill_no?: string
  payment_term?: string
  payment_term_outstanding?: number
}

export interface GetOutstandingArgs {
  posting_date: string
  company: string
  party_type: string
  payment_type: string
  party: string
  party_account: string
  cost_center?: string
  get_outstanding_invoices?: boolean
  from_posting_date?: string
  to_posting_date?: string
  from_due_date?: string
  to_due_date?: string
  outstanding_amt_greater_than?: number
  outstanding_amt_less_than?: number
  allocate_payment_amount?: boolean
}

export interface InvoiceAllocation {
  reference_doctype: string
  reference_name: string
  due_date?: string
  total_amount: number
  outstanding_amount: number
  allocated_amount: number
  exchange_rate?: number
  account?: string
}

export interface PaymentDeductionForm {
  id: string
  account: string
  cost_center: string
  amount: number
  description: string
}

export interface RecordPaymentData {
  payment_type: "Receive" | "Pay" | "Internal Transfer"
  party_type: string
  party: string
  posting_date: string
  company: string
  mode_of_payment?: string
  paid_from: string
  paid_from_account_currency: string
  paid_to: string
  paid_to_account_currency: string
  paid_amount: number
  received_amount: number
  source_exchange_rate: number
  target_exchange_rate: number
  base_paid_amount: number
  base_received_amount: number
  bank_account?: string
  party_bank_account?: string
  contact_person?: string
  contact_email?: string
  reference_no?: string
  reference_date?: string
  remarks?: string
  amended_from?: string
  references: InvoiceAllocation[]
  deductions: { account: string; cost_center: string; amount: number; description?: string }[]
}
