import { apiClient, serverMessagesFromBody, type AppMessage } from "@/services/api-client"
import { postMethodRaw } from "@/services/frappe-client"
import type { BankTransactionDoc } from "../types"

export type { BankTransactionDoc } from "../types"

// Fields mirror bank_transaction.json (in_list_view + the form's grid fields).
const LIST_FIELDS = [
  "name",
  "date",
  "status",
  "docstatus",
  "bank_account",
  "company",
  "currency",
  "description",
  "reference_number",
  "transaction_id",
  "transaction_type",
  "deposit",
  "withdrawal",
  "allocated_amount",
  "unallocated_amount",
  "party_type",
  "party",
  "bank_party_name",
  "bank_party_account_number",
  "bank_party_iban",
  "included_fee",
  "excluded_fee",
  "payment_entries",
]

export interface ListBankTransactionsParams {
  status?: string
  bankAccount?: string
  search?: string
  page?: number
  pageSize?: number
}

// GET /resource/Bank Transaction — frappe.get_list wire format.
export async function listBankTransactions(
  params: ListBankTransactionsParams = {}
): Promise<BankTransactionDoc[]> {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(LIST_FIELDS))

  const filters: unknown[] = []
  if (params.status) filters.push(["status", "=", params.status])
  if (params.bankAccount) filters.push(["bank_account", "=", params.bankAccount])
  if (filters.length > 0) qp.set("filters", JSON.stringify(filters))

  if (params.search) {
    qp.set(
      "or_filters",
      JSON.stringify([
        ["name", "like", `%${params.search}%`],
        ["description", "like", `%${params.search}%`],
        ["reference_number", "like", `%${params.search}%`],
      ])
    )
  }

  qp.set("order_by", "date desc")
  const page = params.page ?? 1
  const size = params.pageSize ?? 20
  qp.set("limit_start", String((page - 1) * size))
  qp.set("limit_page_length", String(size))

  const data = await apiClient<BankTransactionDoc[]>(`/resource/Bank Transaction?${qp.toString()}`)
  return data ?? []
}

// GET /resource/Bank Transaction/<name>
export async function getBankTransaction(name: string): Promise<BankTransactionDoc> {
  return apiClient<BankTransactionDoc>(
    `/resource/Bank Transaction/${encodeURIComponent(name)}`
  )
}

// PUT /resource/Bank Transaction/<name>
export async function updateBankTransaction(
  name: string,
  patch: Partial<BankTransactionDoc>
): Promise<BankTransactionDoc> {
  return apiClient<BankTransactionDoc>(
    `/resource/Bank Transaction/${encodeURIComponent(name)}`,
    { method: "PUT", body: JSON.stringify(patch) }
  )
}

export interface RemovePaymentEntriesResult {
  doc: BankTransactionDoc | null
  messages: AppMessage[]
}

// Bank Transaction.remove_payment_entries — the "Unreconcile Transaction"
// button clears every linked voucher from the payment_entries child table.
export async function removePaymentEntries(
  doc: BankTransactionDoc
): Promise<RemovePaymentEntriesResult> {
  const body = await postMethodRaw<{
    docs?: BankTransactionDoc[]
    message?: BankTransactionDoc
    _server_messages?: unknown
  }>(
    "run_doc_method",
    { method: "remove_payment_entries", docs: JSON.stringify(doc) },
    { "x-frappe-doctype": encodeURIComponent("Bank Transaction") }
  )
  return {
    doc: body.docs?.[0] ?? body.message ?? null,
    messages: serverMessagesFromBody(body),
  }
}
