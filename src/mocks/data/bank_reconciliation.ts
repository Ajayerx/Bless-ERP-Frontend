// Shared in-memory mock backend for the Bank Reconciliation Tool.
//
// Mirrors erpnext/accounts/doctype/bank_reconciliation_tool/bank_reconciliation_tool.py
// and the Desk UI's bank_reconciliation_tool.js / data_table_manager.js. It is
// framework-free (no MSW, no React) so both the node test server
// (src/mocks/server.ts) and the browser worker (src/mocks/handlers/bank_reconciliation.ts)
// can dispatch to the same pure functions.
//
// Reconciling a bank transaction also writes the created Payment Entry / Journal
// Entry into the Payment Reconciliation store (src/mocks/data/reconciliation.ts)
// so the two tools stay consistent, matching the plan's shared-ledger design.

import { reconState } from "./reconciliation"

export interface BtPaymentEntry {
  payment_document: string
  payment_entry: string
  allocated_amount: number
}

export interface BankTransactionRecord {
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
  status: "Reconciled" | "Unreconciled" | "Cancelled"
  docstatus: 0 | 1 | 2
  party_type: string
  party: string
  bank_party_name: string
  bank_party_account_number: string
  bank_party_iban: string
  included_fee: number
  excluded_fee: number
  payment_entries: BtPaymentEntry[]
}

export interface CandidateVoucher {
  doctype: string
  name: string
  reference_date: string
  amount: number
  remaining_amount: number
  reference_number: string
  party: string
}

export interface BankTransactionView extends BankTransactionRecord {
  unallocated_amount: number
}

interface BankReconState {
  company: string
  currency: string
  erpBalance: number
  transactions: BankTransactionRecord[]
  createdVouchers: Array<{ doctype: string; name: string; bank_transaction: string }>
  // Per-bank file-column → Bank Transaction field mapping used by the
  // statement import wizard (mirrors Bank.bank_transaction_mapping).
  bankMappings: Record<string, Record<string, string>>
}

const DEFAULT_TRANSACTIONS: BankTransactionRecord[] = [
  {
    name: "BT-2026-0001",
    date: "2026-09-02",
    bank_account: "Cheque - BE",
    company: "Bless Erp",
    currency: "CAD",
    description: "AlphaCorp wire transfer",
    reference_number: "WIRE-092",
    transaction_id: "TX-100092",
    transaction_type: "Wire Transfer",
    deposit: 1500,
    withdrawal: 0,
    allocated_amount: 0,
    status: "Unreconciled",
    party_type: "Customer",
    party: "AlphaCorp",
    bank_party_name: "AlphaCorp Inc",
    bank_party_account_number: "****-1001",
    bank_party_iban: "",
    included_fee: 0,
    excluded_fee: 0,
    docstatus: 1,
    payment_entries: [],
  },
  {
    name: "BT-2026-0002",
    date: "2026-09-12",
    bank_account: "Cheque - BE",
    company: "Bless Erp",
    currency: "CAD",
    description: "AlphaCorp wire transfer 2",
    reference_number: "WIRE-093",
    transaction_id: "TX-100093",
    transaction_type: "Wire Transfer",
    deposit: 900,
    withdrawal: 0,
    allocated_amount: 0,
    status: "Unreconciled",
    party_type: "Customer",
    party: "AlphaCorp",
    bank_party_name: "AlphaCorp Inc",
    bank_party_account_number: "****-1001",
    bank_party_iban: "",
    included_fee: 0,
    excluded_fee: 0,
    docstatus: 1,
    payment_entries: [],
  },
  {
    name: "BT-2026-0003",
    date: "2026-09-15",
    bank_account: "Cheque - BE",
    company: "Bless Erp",
    currency: "CAD",
    description: "Bank service charges",
    reference_number: "",
    transaction_id: "TX-100094",
    transaction_type: "Bank Fee",
    deposit: 0,
    withdrawal: 220,
    allocated_amount: 0,
    status: "Unreconciled",
    party_type: "",
    party: "",
    bank_party_name: "",
    bank_party_account_number: "",
    bank_party_iban: "",
    included_fee: 0,
    excluded_fee: 0,
    docstatus: 1,
    payment_entries: [],
  },
  {
    name: "BT-2026-0004",
    date: "2026-08-20",
    bank_account: "Cheque - BE",
    company: "Bless Erp",
    currency: "CAD",
    description: "VendorOne outgoing payment",
    reference_number: "WIRE-081",
    transaction_id: "TX-100081",
    transaction_type: "Wire Transfer",
    deposit: 0,
    withdrawal: 3000,
    allocated_amount: 0,
    status: "Unreconciled",
    party_type: "Supplier",
    party: "VendorOne",
    bank_party_name: "VendorOne Ltd",
    bank_party_account_number: "****-2001",
    bank_party_iban: "",
    included_fee: 0,
    excluded_fee: 0,
    docstatus: 1,
    payment_entries: [],
  },
]

// Vouchers get_linked_payments can propose for matching (ERPNext runs a UNION
// query over Payment Entry + Journal Entry + Sales/Purchase Invoice).
const DEFAULT_CANDIDATES: CandidateVoucher[] = [
  { doctype: "Payment Entry", name: "ACC-PAY-2026-00051", reference_date: "2026-09-02", amount: 1500, remaining_amount: 1500, reference_number: "WIRE-092", party: "AlphaCorp" },
  { doctype: "Sales Invoice", name: "ACC-SINV-2026-00031", reference_date: "2026-09-01", amount: 1500, remaining_amount: 1500, reference_number: "", party: "AlphaCorp" },
  { doctype: "Payment Entry", name: "ACC-PAY-2026-00052", reference_date: "2026-09-12", amount: 900, remaining_amount: 900, reference_number: "WIRE-093", party: "AlphaCorp" },
  { doctype: "Sales Invoice", name: "ACC-SINV-2026-00032", reference_date: "2026-09-10", amount: 900, remaining_amount: 900, reference_number: "", party: "AlphaCorp" },
  { doctype: "Payment Entry", name: "ACC-PAY-2026-00054", reference_date: "2026-08-20", amount: 3000, remaining_amount: 3000, reference_number: "WIRE-081", party: "VendorOne" },
  { doctype: "Purchase Invoice", name: "ACC-PINV-2026-00021", reference_date: "2026-08-15", amount: 3000, remaining_amount: 3000, reference_number: "", party: "VendorOne" },
  { doctype: "Journal Entry", name: "ACC-JV-2026-00012", reference_date: "2026-08-27", amount: 412.5, remaining_amount: 412.5, reference_number: "", party: "BetaInc" },
]

const RECONCILABLE_DOCTYPES = [
  "Payment Entry",
  "Journal Entry",
  "Sales Invoice",
  "Purchase Invoice",
]

// Default statement-column → Bank Transaction field mapping (the shape stored on
// Bank.bank_transaction_mapping / returned by get_bank_mapping in ERPNext).
export const DEFAULT_BANK_MAPPING: Record<string, string> = {
  Date: "date",
  Description: "description",
  Deposit: "deposit",
  Withdrawal: "withdrawal",
  "Reference Number": "reference_number",
  "Transaction ID": "transaction_id",
  "Transaction Type": "transaction_type",
  Party: "party",
  "Party Type": "party_type",
  Currency: "currency",
  "Bank Party Name": "bank_party_name",
  "Party Account Number": "bank_party_account_number",
  IBAN: "bank_party_iban",
}

export const IMPORT_MAPPABLE_FIELDS = [
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

export const bankReconState: BankReconState = {
  company: "Bless Erp",
  currency: "CAD",
  erpBalance: 245000.5,
  transactions: DEFAULT_TRANSACTIONS.map((t) => ({ ...t, payment_entries: [] })),
  createdVouchers: [],
  bankMappings: {},
}

export function resetBankReconFixtures(): void {
  bankReconState.erpBalance = 245000.5
  bankReconState.transactions = DEFAULT_TRANSACTIONS.map((t) => ({ ...t, payment_entries: [] }))
  bankReconState.createdVouchers = []
  bankReconState.bankMappings = {}
}

export function setBankErpBalance(value: number): void {
  bankReconState.erpBalance = value
}

export function getReconcilableDoctypes(): string[] {
  return [...RECONCILABLE_DOCTYPES]
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value)
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }
  if (raw && typeof raw === "object") return raw as T
  return fallback
}

// frappe.scrub — the dialog sends `document_types` as scrubbed fieldnames.
function scrubDoctype(value: string): string {
  return value.toLowerCase().replace(/ /g, "_")
}

// ERPNext Bank Transaction.update_allocated_amount:
//   unallocated_amount = abs(withdrawal - deposit) - allocated_amount
export function unallocatedAmount(t: BankTransactionRecord): number {
  return round2(Math.abs(t.withdrawal - t.deposit) - t.allocated_amount)
}

function view(t: BankTransactionRecord): BankTransactionView {
  return { ...t, unallocated_amount: unallocatedAmount(t) }
}

function serverMessage(message: string, indicator = "red"): Record<string, unknown> {
  return { _server_messages: JSON.stringify([{ message, title: "Message", indicator }]) }
}

function inRange(date: string, from: unknown, to: unknown): boolean {
  const f = text(from)
  const t = text(to)
  if (f && date < f) return false
  if (t && date > t) return false
  return true
}

export interface MockResponse {
  body: Record<string, unknown>
  status?: number
}

// get_bank_transactions(bank_account, from_date, to_date, filter_by_reference_date)
export function getBankTransactions(args: Record<string, unknown>): MockResponse {
  const bankAccount = text(args.bank_account)
  const from = args.from_date
  const to = args.to_date
  const rows = bankReconState.transactions
    .filter((t) => (!bankAccount || t.bank_account === bankAccount) && inRange(t.date, from, to))
    .filter((t) => t.docstatus === 1 && unallocatedAmount(t) > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map(view)
  return { body: { message: rows } }
}

// get_account_balance(bank_account, till_date, company)
export function getAccountBalance(): MockResponse {
  return { body: { message: { closing_balance: bankReconState.erpBalance } } }
}

// get_linked_payments(bank_transaction, document_types, ...) — ranks exact-amount
// candidates first, then by remaining amount, and subtracts prior allocations.
export function getLinkedPayments(args: Record<string, unknown>): MockResponse {
  const bankTransaction = text(args.bank_transaction)
  const documentTypes = parseJson<string[]>(args.document_types, []).map(scrubDoctype)
  const bt = bankReconState.transactions.find((t) => t.name === bankTransaction)
  if (!bt) return { body: { message: [] } }
  // No document types selected → no matching queries (matches check_matching).
  if (documentTypes.length === 0) return { body: { message: [] } }
  const target = Math.abs(unallocatedAmount(bt))
  const rows = DEFAULT_CANDIDATES.filter((c) => {
    if (!documentTypes.includes(scrubDoctype(c.doctype))) return false
    if (bt.party && c.party && c.party !== bt.party) return false
    return c.remaining_amount <= target + 0.001
  }).map((c) => ({
    doctype: c.doctype,
    name: c.name,
    reference_date: c.reference_date,
    amount: c.amount,
    remaining_amount: c.remaining_amount,
    reference_number: c.reference_number,
    party: c.party,
    is_exact_match: Math.abs(c.remaining_amount - target) < 0.001 ? 1 : 0,
  }))
  rows.sort((a, b) => b.is_exact_match - a.is_exact_match || a.name.localeCompare(b.name))
  return { body: { message: rows } }
}

export interface ReconcileVoucherInput {
  doctype: string
  name: string
  amount: number
}

// reconcile_vouchers(bank_transaction, vouchers)
export function reconcileVouchers(args: Record<string, unknown>): MockResponse {
  const name = text(args.bank_transaction)
  const vouchers = parseJson<ReconcileVoucherInput[]>(args.vouchers, [])
  const bt = bankReconState.transactions.find((t) => t.name === name)
  if (!bt) {
    return { body: serverMessage(`Bank Transaction ${name} not found.`), status: 404 }
  }
  if (vouchers.length === 0) {
    return { body: serverMessage("Please select at least one voucher to reconcile."), status: 417 }
  }
  for (const voucher of vouchers) {
    const allocated = round2(Number(voucher.amount ?? 0))
    bt.payment_entries.push({
      payment_document: text(voucher.doctype),
      payment_entry: text(voucher.name),
      allocated_amount: allocated,
    })
    bt.allocated_amount = round2(bt.allocated_amount + allocated)
  }
  bt.status = Math.abs(unallocatedAmount(bt)) < 0.001 ? "Reconciled" : "Unreconciled"
  return {
    body: {
      message: view(bt),
      _server_messages: JSON.stringify([
        { message: `Bank Transaction ${bt.name} Matched`, title: "Message", indicator: "green" },
      ]),
    },
  }
}

// create_payment_entry_bts(bank_transaction, ...) — creates the Payment Entry and
// allocates it against the transaction in one step.
export function createPaymentEntryBts(args: Record<string, unknown>): MockResponse {
  const name = text(args.bank_transaction)
  const bt = bankReconState.transactions.find((t) => t.name === name)
  if (!bt) return { body: serverMessage(`Bank Transaction ${name} not found.`), status: 404 }
  if (!bt.party_type || !bt.party) {
    return { body: serverMessage("Party Type and Party is mandatory to create a Payment Entry."), status: 417 }
  }
  const amount = Math.abs(unallocatedAmount(bt))
  const entryName = `ACC-PAY-2026-9${String(reconState.payments.length + 1).padStart(3, "0")}`
  reconState.payments.push({
    reference_type: "Payment Entry",
    reference_name: entryName,
    party_type: bt.party_type as "Customer" | "Supplier",
    party: bt.party,
    posting_date: text(args.posting_date) || bt.date,
    amount,
    difference_amount: 0,
    reconciled: 0,
    cost_center: text(args.cost_center) || "Main - BE",
  })
  bt.payment_entries.push({
    payment_document: "Payment Entry",
    payment_entry: entryName,
    allocated_amount: amount,
  })
  bt.allocated_amount = round2(bt.allocated_amount + amount)
  bt.status = "Reconciled"
  bankReconState.createdVouchers.push({ doctype: "Payment Entry", name: entryName, bank_transaction: bt.name })
  return { body: { message: { doctype: "Payment Entry", name: entryName } } }
}

// create_journal_entry_bts(bank_transaction, ...) — mirrors the Payment Entry path
// but books a Journal Entry (e.g. bank charges, interest).
export function createJournalEntryBts(args: Record<string, unknown>): MockResponse {
  const name = text(args.bank_transaction)
  const bt = bankReconState.transactions.find((t) => t.name === name)
  if (!bt) return { body: serverMessage(`Bank Transaction ${name} not found.`), status: 404 }
  const account = text(args.account)
  if (!account) {
    return { body: serverMessage("Account is mandatory to create a Journal Entry."), status: 417 }
  }
  const amount = Math.abs(unallocatedAmount(bt))
  const entryName = `ACC-JV-2026-9${String(reconState.reconciledJournalEntries.length + 1).padStart(3, "0")}`
  reconState.reconciledJournalEntries.push({ name: entryName, amount, account })
  if (bt.party_type && bt.party) {
    reconState.payments.push({
      reference_type: "Journal Entry",
      reference_name: entryName,
      party_type: bt.party_type as "Customer" | "Supplier",
      party: bt.party,
      posting_date: text(args.posting_date) || bt.date,
      amount,
      difference_amount: 0,
      reconciled: 0,
      cost_center: text(args.cost_center) || "Main - BE",
    })
  }
  bt.payment_entries.push({
    payment_document: "Journal Entry",
    payment_entry: entryName,
    allocated_amount: amount,
  })
  bt.allocated_amount = round2(bt.allocated_amount + amount)
  bt.status = "Reconciled"
  bankReconState.createdVouchers.push({ doctype: "Journal Entry", name: entryName, bank_transaction: bt.name })
  return { body: { message: { doctype: "Journal Entry", name: entryName } } }
}

// update_bank_transaction(bank_transaction, reference_number, party_type, party)
export function updateBankTransaction(args: Record<string, unknown>): MockResponse {
  const name = text(args.bank_transaction)
  const bt = bankReconState.transactions.find((t) => t.name === name)
  if (!bt) return { body: serverMessage(`Bank Transaction ${name} not found.`), status: 404 }
  if (args.reference_number !== undefined) bt.reference_number = text(args.reference_number)
  if (args.party_type !== undefined) bt.party_type = text(args.party_type)
  if (args.party !== undefined) bt.party = text(args.party)
  return {
    body: {
      message: view(bt),
      _server_messages: JSON.stringify([
        { message: `Bank Transaction ${bt.name} updated`, title: "Message", indicator: "green" },
      ]),
    },
  }
}

// auto_reconcile_vouchers(bank_account, from_date, to_date, ...) — server-side
// best-effort matching against exact-amount candidates.
export function autoReconcileVouchers(args: Record<string, unknown>): MockResponse {
  const bankAccount = text(args.bank_account)
  const from = args.from_date
  const to = args.to_date
  let matched = 0
  for (const bt of bankReconState.transactions) {
    if (bt.status !== "Unreconciled") continue
    if (bankAccount && bt.bank_account !== bankAccount) continue
    if (!inRange(bt.date, from, to)) continue
    const target = Math.abs(unallocatedAmount(bt))
    const candidate = DEFAULT_CANDIDATES.find(
      (c) =>
        c.remaining_amount > 0 &&
        Math.abs(c.remaining_amount - target) < 0.001 &&
        (!bt.party || !c.party || c.party === bt.party)
    )
    if (!candidate) continue
    bt.payment_entries.push({
      payment_document: candidate.doctype,
      payment_entry: candidate.name,
      allocated_amount: candidate.remaining_amount,
    })
    bt.allocated_amount = round2(bt.allocated_amount + candidate.remaining_amount)
    bt.status = "Reconciled"
    matched += 1
  }
  return {
    body: {
      message: { matched },
      _server_messages: JSON.stringify([
        { message: `Auto Reconciliation completed. ${matched} transaction(s) reconciled.`, title: "Message", indicator: "green" },
      ]),
    },
  }
}

export function findBankTransaction(name: string): BankTransactionView | null {
  const bt = bankReconState.transactions.find((t) => t.name === name)
  return bt ? view(bt) : null
}

// --- REST resource surface (/api/resource/Bank Transaction) --------------
// Mirrors frappe.get_list / frappe.get_doc / frappe.db.set_value for the
// Bank Transaction doctype so the list + detail pages can use the real
// ERPNext REST wire format.

type FilterTuple = [string, string, unknown]

function parseFilters(raw: unknown): FilterTuple[] {
  const parsed = parseJson<unknown>(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (f): f is FilterTuple => Array.isArray(f) && f.length >= 3
  ) as FilterTuple[]
}

function matchesFilter(value: unknown, op: string, target: unknown): boolean {
  switch (op) {
    case "=":
      return String(value) === String(target)
    case "!=":
      return String(value) !== String(target)
    case ">":
      return Number(value) > Number(target)
    case "<":
      return Number(value) < Number(target)
    case ">=":
      return Number(value) >= Number(target)
    case "<=":
      return Number(value) <= Number(target)
    case "in":
      return Array.isArray(target) ? target.map(String).includes(String(value)) : false
    case "like":
      return String(value).toLowerCase().includes(String(target).replace(/%/g, "").toLowerCase())
    case "not like":
      return !String(value).toLowerCase().includes(String(target).replace(/%/g, "").toLowerCase())
    default:
      return true
  }
}

function recomputeStatus(t: BankTransactionRecord): void {
  if (t.docstatus === 2) {
    t.status = "Cancelled"
  } else if (t.payment_entries.length > 0 && unallocatedAmount(t) <= 0) {
    t.status = "Reconciled"
  } else {
    t.status = "Unreconciled"
  }
}

export interface BankTransactionListQuery {
  fields?: unknown
  filters?: unknown
  or_filters?: unknown
  order_by?: string
  limit_start?: unknown
  limit_page_length?: unknown
}

export function listBankTransactions(args: BankTransactionListQuery): MockResponse {
  const filters = parseFilters(args.filters)
  const orFilters = parseFilters(args.or_filters)
  const rows = bankReconState.transactions.filter((t) => {
    const ok = filters.every(([field, op, value]) =>
      matchesFilter((t as unknown as Record<string, unknown>)[field], op, value)
    )
    if (!ok) return false
    if (orFilters.length === 0) return true
    return orFilters.some(([field, op, value]) =>
      matchesFilter((t as unknown as Record<string, unknown>)[field], op, value)
    )
  })

  const [field, dir] = (text(args.order_by) || "date desc").split(/\s+/)
  rows.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[field]
    const bv = (b as unknown as Record<string, unknown>)[field]
    const cmp = av === bv ? 0 : String(av ?? "") < String(bv ?? "") ? -1 : 1
    return /desc/i.test(dir ?? "") ? -cmp : cmp
  })

  const start = Number(args.limit_start ?? 0) || 0
  const limit = Number(args.limit_page_length ?? 20) || 20
  const fields = parseJson<string[]>(args.fields, [])
  const project = (t: BankTransactionRecord): Record<string, unknown> => {
    const full = view(t) as unknown as Record<string, unknown>
    if (fields.length === 0) return full
    const out: Record<string, unknown> = {}
    for (const f of fields) out[f] = full[f]
    return out
  }
  return { body: { data: rows.slice(start, start + limit).map(project) } }
}

export function getBankTransactionDoc(name: string): MockResponse {
  const bt = bankReconState.transactions.find((t) => t.name === name)
  if (!bt) return { body: { data: null }, status: 404 }
  return { body: { data: view(bt) } }
}

const EDITABLE_FIELDS = [
  "date",
  "bank_account",
  "company",
  "currency",
  "description",
  "reference_number",
  "transaction_id",
  "transaction_type",
  "deposit",
  "withdrawal",
  "party_type",
  "party",
  "bank_party_name",
  "bank_party_account_number",
  "bank_party_iban",
  "included_fee",
  "excluded_fee",
] as const

export function updateBankTransactionDoc(
  name: string,
  patch: Record<string, unknown>
): MockResponse {
  const bt = bankReconState.transactions.find((t) => t.name === name)
  if (!bt) return { body: { data: null }, status: 404 }
  for (const field of EDITABLE_FIELDS) {
    if (patch[field] === undefined) continue
    if (field === "deposit" || field === "withdrawal" || field === "included_fee" || field === "excluded_fee") {
      ;(bt as unknown as Record<string, unknown>)[field] = Number(patch[field] ?? 0)
    } else {
      ;(bt as unknown as Record<string, unknown>)[field] = text(patch[field])
    }
  }
  recomputeStatus(bt)
  return {
    body: {
      data: view(bt),
      _server_messages: JSON.stringify([
        { message: `Bank Transaction ${bt.name} updated`, title: "Message", indicator: "green" },
      ]),
    },
  }
}

// Bank Transaction.remove_payment_entries — "Unreconcile Transaction": delink
// every linked voucher and reset the allocated amount.
export function removeBankTransactionPaymentEntries(doc: Record<string, unknown>): MockResponse {
  const name = text(doc.name)
  const bt = bankReconState.transactions.find((t) => t.name === name)
  if (!bt) return { body: serverMessage(`Bank Transaction ${name} not found.`), status: 404 }

  const linked = bt.payment_entries.map((pe) => pe.payment_entry)
  for (const pe of linked) {
    const index = reconState.payments.findIndex((p) => p.reference_name === pe)
    if (index >= 0) reconState.payments.splice(index, 1)
    reconState.reconciledJournalEntries = reconState.reconciledJournalEntries.filter(
      (j) => j.name !== pe
    )
  }
  bankReconState.createdVouchers = bankReconState.createdVouchers.filter(
    (v) => v.bank_transaction !== bt.name
  )
  bt.payment_entries = []
  bt.allocated_amount = 0
  recomputeStatus(bt)
  return {
    body: {
      docs: [view(bt)],
      message: view(bt),
      _server_messages: JSON.stringify([
        { message: `Bank Transaction ${bt.name} unreconciled`, title: "Message", indicator: "green" },
      ]),
    },
  }
}

// --- Bank statement import (bank_transaction_upload.py) ------------------
// Ports upload_bank_statement / get_bank_mapping / get_header_mapping /
// create_bank_entries. ERPNext feeds the uploaded CSV/XLSX straight into
// rows, so the mock parses the CSV text the client sends.

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (ch !== "\r") {
      field += ch
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""))
}

function numberFromCell(value: unknown): number {
  const raw = text(value).replace(/[,$\s]/g, "")
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? round2(n) : 0
}

function normaliseDate(value: unknown): string {
  const raw = text(value).trim()
  if (!raw) throw new Error("Missing date")
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`
  }
  const us = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  throw new Error("Invalid date")
}

// upload_bank_statement(file_name, content) → { columns, data }
export function uploadBankStatement(args: Record<string, unknown>): MockResponse {
  const content = text(args.content)
  if (!content) {
    return { body: serverMessage("Please choose a CSV file to upload."), status: 417 }
  }
  const rows = parseCsv(content)
  if (rows.length === 0) {
    return { body: serverMessage("The uploaded file does not contain any rows."), status: 417 }
  }
  const [columns, ...data] = rows
  return { body: { message: { columns, data } } }
}

// get_bank_mapping(bank_account) → { file_column: bank_transaction_field }
export function getBankMapping(args: Record<string, unknown>): MockResponse {
  const bankAccount = text(args.bank_account)
  const mapping = bankReconState.bankMappings[bankAccount] ?? { ...DEFAULT_BANK_MAPPING }
  return { body: { message: mapping } }
}

// get_header_mapping(columns, bank_account) → { bank_transaction_field: colIndex }
// `columns` is the JSON array of { content } objects; colIndex is 1-based to
// mirror ERPNext's create_bank_entries (`d[int(value) - 1]`).
export function getHeaderMapping(args: Record<string, unknown>): MockResponse {
  const bankAccount = text(args.bank_account)
  const columns = parseJson<Array<{ content?: string }>>(args.columns, [])
  const mapping = bankReconState.bankMappings[bankAccount] ?? DEFAULT_BANK_MAPPING
  const headerMap: Record<string, number> = {}
  columns.forEach((column, index) => {
    const field = mapping[text(column.content)]
    if (field) headerMap[field] = index + 1
  })
  return { body: { message: headerMap } }
}

// save_bank_mapping(bank_account, mapping) — persists the wizard's mapping.
export function saveBankMapping(args: Record<string, unknown>): MockResponse {
  const bankAccount = text(args.bank_account)
  if (!bankAccount) {
    return { body: serverMessage("Bank Account is required to save the mapping."), status: 417 }
  }
  const mapping = parseJson<Record<string, string>>(args.mapping, {})
  bankReconState.bankMappings[bankAccount] = { ...mapping }
  return {
    body: {
      message: "Bank mapping saved",
      _server_messages: JSON.stringify([
        { message: "Bank statement column mapping saved", title: "Message", indicator: "green" },
      ]),
    },
  }
}

function buildImportedTransaction(
  fields: Record<string, unknown>,
  bankAccount: string
): BankTransactionRecord {
  let seq = bankReconState.transactions.length + 1
  let name = `BT-2026-${String(seq).padStart(4, "0")}`
  while (bankReconState.transactions.some((t) => t.name === name)) {
    seq += 1
    name = `BT-2026-${String(seq).padStart(4, "0")}`
  }
  return {
    name,
    date: normaliseDate(fields.date),
    bank_account: bankAccount,
    company: bankReconState.company,
    currency: text(fields.currency) || bankReconState.currency,
    description: text(fields.description) || "Imported bank statement entry",
    reference_number: text(fields.reference_number),
    transaction_id: text(fields.transaction_id),
    transaction_type: text(fields.transaction_type) || "Bank Statement",
    deposit: numberFromCell(fields.deposit),
    withdrawal: numberFromCell(fields.withdrawal),
    allocated_amount: 0,
    status: "Unreconciled",
    docstatus: 1,
    party_type: text(fields.party_type),
    party: text(fields.party),
    bank_party_name: text(fields.bank_party_name),
    bank_party_account_number: text(fields.bank_party_account_number),
    bank_party_iban: text(fields.bank_party_iban),
    included_fee: numberFromCell(fields.included_fee),
    excluded_fee: numberFromCell(fields.excluded_fee),
    payment_entries: [],
  }
}

// create_bank_entries(columns, data, bank_account) → { success, errors }
export function createBankEntries(args: Record<string, unknown>): MockResponse {
  const bankAccount = text(args.bank_account)
  const columns = parseJson<Array<{ content?: string }>>(args.columns, [])
  const data = parseJson<Array<Array<string | number | null>>>(args.data, [])
  if (!bankAccount) {
    return { body: serverMessage("Bank Account is mandatory to import bank statements."), status: 417 }
  }
  if (columns.length === 0) {
    return { body: serverMessage("Please map the statement columns before importing."), status: 417 }
  }
  const headerMap = (
    getHeaderMapping({ columns: JSON.stringify(columns), bank_account: bankAccount }).body.message
  ) as Record<string, number>

  let success = 0
  let errors = 0
  for (const raw of data) {
    if (raw.every((cell) => cell === null || cell === undefined || String(cell).trim() === "")) {
      continue
    }
    const fields: Record<string, unknown> = {}
    for (const [field, colIndex] of Object.entries(headerMap)) {
      fields[field] = raw[colIndex - 1]
    }
    try {
      bankReconState.transactions.push(buildImportedTransaction(fields, bankAccount))
      success += 1
    } catch {
      errors += 1
    }
  }
  return {
    body: {
      message: { success, errors },
      _server_messages: JSON.stringify([
        {
          message: `Imported ${success} bank transaction(s)${errors ? `, ${errors} row(s) failed` : ""}.`,
          title: "Message",
          indicator: errors ? "orange" : "green",
        },
      ]),
    },
  }
}
