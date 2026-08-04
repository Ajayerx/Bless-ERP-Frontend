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
  row_id?: string
  account_head: string
  description?: string
  rate?: number
  tax_amount?: number
  total?: number
  base_tax_amount?: number
  base_total?: number
  currency?: string
  included_in_paid_amount?: number
  allocated_amount?: number
  cost_center?: string
  project?: string
  tax_fraction_for_current_item?: number
  grand_total_fraction_for_current_item?: number
}

export interface PaymentComment {
  id: string
  content: string
  author: string
  createdAt: string
}

export interface PaymentEntry {
  name: string
  modified?: string
  naming_series?: string
  payment_type: string
  payment_order_status?: string
  posting_date: string
  company: string
  owner?: string
  creation?: string
  submitted_by?: string
  submitted_on?: string
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
  sales_taxes_and_charges_template?: string
  purchase_taxes_and_charges_template?: string
  apply_tax_withholding_amount?: number
  tax_withholding_category?: string
  total_taxes_and_charges?: number
  base_total_taxes_and_charges?: number
  bank_account?: string
  bank?: string
  bank_account_no?: string
  party_bank_account?: string
  contact_person?: string
  contact_email?: string
  cost_center?: string
  project?: string
  letter_head?: string
  print_heading?: string
  is_opening?: number
  book_advance_payments_in_separate_party_account?: number
  reconcile_on_advance_payment_date?: number
  reference_no?: string
  reference_date?: string
  clearance_date?: string
  remarks?: string
  custom_remarks?: number
  in_words?: string
  base_in_words?: string
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

export interface ContactDetails {
  contact_person: string
  contact_display: string
  contact_email: string
  contact_mobile: string
  contact_phone: string
  contact_designation?: string
  contact_department?: string
}

export interface BankAccountDetails {
  account?: string
  bank?: string
  bank_account_no?: string
}

export interface PartyAndAccountBalance {
  paid_from_account_balance: number
  paid_to_account_balance: number
  party_balance: number
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
  exchange_gain_loss?: number
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
  exchange_gain_loss?: number
  account?: string
}

export interface PaymentDeductionForm {
  id: string
  account: string
  cost_center: string
  amount: number
  description: string
  is_exchange_gain_loss?: number
}

export interface LedgerPreviewColumn {
  fieldname?: string
  label?: string
  name?: string
  fieldtype?: string
  width?: number
}

export interface LedgerPreviewData {
  gl_columns: LedgerPreviewColumn[]
  gl_data: Record<string, unknown>[] | unknown[][]
}

export interface RecordPaymentData {
  naming_series?: string
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
  sales_taxes_and_charges_template?: string
  purchase_taxes_and_charges_template?: string
  apply_tax_withholding_amount?: number
  tax_withholding_category?: string
  bank_account?: string
  party_bank_account?: string
  contact_person?: string
  contact_email?: string
  cost_center?: string
  project?: string
  letter_head?: string
  print_heading?: string
  is_opening?: number
  book_advance_payments_in_separate_party_account?: number
  reconcile_on_advance_payment_date?: number
  reference_no?: string
  reference_date?: string
  clearance_date?: string
  custom_remarks?: number
  remarks?: string
  amended_from?: string
  references: InvoiceAllocation[]
  deductions?: { account: string; cost_center: string; amount: number; description?: string; is_exchange_gain_loss?: number }[]
  taxes?: PaymentEntryTax[]
}
