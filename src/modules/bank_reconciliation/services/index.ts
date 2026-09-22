import { postMethod, postMethodRaw } from "@/services/frappe-client"
import { serverMessagesFromBody, type AppMessage } from "@/services/api-client"
import type {
  AutoReconcileResult,
  BankImportResult,
  BankReconciliationStatement,
  BankStatementMapping,
  BankStatementPreview,
  BankTransaction,
  LinkedVoucher,
  ReconcileVoucherInput,
  VoucherCreationResult,
} from "../types"

// All calls hit erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool
// exactly like the Desk page (frappe.call with bank_account / dates / vouchers).
const TOOL = "erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool"

export interface BankReconListResult {
  transactions: BankTransaction[]
  messages: AppMessage[]
}

// get_bank_transactions(bank_account, from_date, to_date, filter_by_reference_date)
export async function getBankTransactions(filters: {
  bank_account: string
  from_date?: string
  to_date?: string
  filter_by_reference_date?: boolean
}): Promise<BankReconListResult> {
  const [transactions, messages] = await Promise.all([
    postMethod<BankTransaction[]>(`${TOOL}.get_bank_transactions`, {
      bank_account: filters.bank_account,
      from_date: filters.from_date ?? "",
      to_date: filters.to_date ?? "",
      filter_by_reference_date: filters.filter_by_reference_date ? 1 : 0,
    }),
    Promise.resolve([]) as Promise<AppMessage[]>,
  ])
  return { transactions: transactions ?? [], messages }
}

// get_account_balance(bank_account, till_date, company) — the "as per ERP" figure
// shown in the middle number card.
export async function getAccountBalance(
  bankAccount: string,
  tillDate: string,
  company: string
): Promise<number> {
  const result = await postMethod<BankReconciliationStatement | number>(
    `${TOOL}.get_account_balance`,
    { bank_account: bankAccount, till_date: tillDate, company }
  )
  if (typeof result === "number") return result
  return Number(result?.closing_balance ?? 0)
}

// get_linked_payments(bank_transaction, document_types, ...) — candidate vouchers
// for the Match Against Voucher table, ranked by exact amount.
export async function getLinkedPayments(
  bankTransaction: string,
  documentTypes: string[]
): Promise<LinkedVoucher[]> {
  const result = await postMethod<LinkedVoucher[]>(`${TOOL}.get_linked_payments`, {
    bank_transaction: bankTransaction,
    document_types: JSON.stringify(documentTypes),
  })
  return result ?? []
}

// reconcile_vouchers(bank_transaction, vouchers) → updated transaction + messages.
export interface ReconcileVouchersResult {
  transaction: BankTransaction | null
  messages: AppMessage[]
}

export async function reconcileVouchers(
  bankTransaction: string,
  vouchers: ReconcileVoucherInput[]
): Promise<ReconcileVouchersResult> {
  const body = await postMethodRaw<{ message?: BankTransaction }>(`${TOOL}.reconcile_vouchers`, {
    bank_transaction: bankTransaction,
    vouchers,
  })
  return {
    transaction: (body.message as BankTransaction) ?? null,
    messages: serverMessagesFromBody(body),
  }
}

// create_payment_entry_bts(bank_transaction, ...) — used by the Create Voucher action.
export async function createPaymentEntryFromBankTransaction(payload: {
  bank_transaction: string
  party_type: string
  party: string
  posting_date?: string
  reference_number?: string
  reference_date?: string
  mode_of_payment?: string
  company_bank_account?: string
  project?: string
  cost_center?: string
}): Promise<VoucherCreationResult> {
  return postMethod<VoucherCreationResult>(`${TOOL}.create_payment_entry_bts`, payload)
}

// create_journal_entry_bts(bank_transaction, ...) — bank charges / interest path.
export async function createJournalEntryFromBankTransaction(payload: {
  bank_transaction: string
  account: string
  posting_date?: string
  reference_number?: string
  reference_date?: string
  mode_of_payment?: string
  journal_entry_type?: string
  party_type?: string
  party?: string
}): Promise<VoucherCreationResult> {
  return postMethod<VoucherCreationResult>(`${TOOL}.create_journal_entry_bts`, payload)
}

// update_bank_transaction(bank_transaction, reference_number, party_type, party)
export interface UpdateBankTransactionResult {
  transaction: BankTransaction | null
  messages: AppMessage[]
}

export async function updateBankTransaction(payload: {
  bank_transaction: string
  reference_number?: string
  party_type?: string
  party?: string
}): Promise<UpdateBankTransactionResult> {
  const body = await postMethodRaw<{ message?: BankTransaction }>(`${TOOL}.update_bank_transaction`, payload)
  return {
    transaction: (body.message as BankTransaction) ?? null,
    messages: serverMessagesFromBody(body),
  }
}

// auto_reconcile_vouchers(bank_account, from_date, to_date, ...)
export async function autoReconcileVouchers(payload: {
  bank_account: string
  from_date?: string
  to_date?: string
  filter_by_reference_date?: boolean
  from_reference_date?: string
  to_reference_date?: string
}): Promise<AutoReconcileResult> {
  const result = await postMethod<AutoReconcileResult | number>(
    `${TOOL}.auto_reconcile_vouchers`,
    {
      bank_account: payload.bank_account,
      from_date: payload.from_date ?? "",
      to_date: payload.to_date ?? "",
      filter_by_reference_date: payload.filter_by_reference_date ? 1 : 0,
      from_reference_date: payload.from_reference_date ?? "",
      to_reference_date: payload.to_reference_date ?? "",
    }
  )
  if (typeof result === "number") return { matched: result }
  return { matched: Number(result?.matched ?? 0) }
}

// bank_transaction.get_doctypes_for_bank_reconciliation — the Match toggle list.
export async function getReconcilableDoctypes(): Promise<string[]> {
  const result = await postMethod<string[]>(
    "erpnext.accounts.doctype.bank_transaction.bank_transaction.get_doctypes_for_bank_reconciliation",
    {}
  )
  return Array.isArray(result) ? result : []
}

// --- Bank Statement Import (bank_transaction_upload.py) -------------------

const UPLOAD = "erpnext.accounts.doctype.bank_transaction.bank_transaction_upload"

// upload_bank_statement(file_name, content) → { columns, data }. The mock parses
// the CSV the client read; the real endpoint ingests the multipart upload.
export async function uploadBankStatement(
  fileName: string,
  content: string
): Promise<BankStatementPreview> {
  const result = await postMethod<BankStatementPreview>(`${UPLOAD}.upload_bank_statement`, {
    file_name: fileName,
    content,
  })
  return { columns: result?.columns ?? [], data: result?.data ?? [] }
}

// get_bank_mapping(bank_account) → { file_column: bank_transaction_field }
export async function getBankMapping(bankAccount: string): Promise<BankStatementMapping> {
  const result = await postMethod<BankStatementMapping>(`${UPLOAD}.get_bank_mapping`, {
    bank_account: bankAccount,
  })
  return result && typeof result === "object" ? result : {}
}

// save_bank_mapping(bank_account, mapping)
export async function saveBankMapping(
  bankAccount: string,
  mapping: BankStatementMapping
): Promise<void> {
  await postMethod<unknown>(`${UPLOAD}.save_bank_mapping`, {
    bank_account: bankAccount,
    mapping,
  })
}

// create_bank_entries(columns, data, bank_account) → { success, errors }
export async function createBankEntries(params: {
  columns: string[]
  data: Array<Array<string | number | null>>
  bankAccount: string
}): Promise<BankImportResult> {
  const result = await postMethod<BankImportResult>(`${UPLOAD}.create_bank_entries`, {
    columns: JSON.stringify(params.columns.map((content) => ({ content }))),
    data: JSON.stringify(params.data),
    bank_account: params.bankAccount,
  })
  return { success: Number(result?.success ?? 0), errors: Number(result?.errors ?? 0) }
}
