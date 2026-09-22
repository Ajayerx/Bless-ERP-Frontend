import { postMethod, postMethodRaw } from "@/services/frappe-client"
import { serverMessagesFromBody, type AppMessage } from "@/services/api-client"
import type {
  PaymentReconciliationWorkspace,
  ReconAllocationRow,
  ReconInvoiceRow,
  ReconPaymentRow,
} from "../types"

// Wire format mirrors ERPNext's Desk form: run_doc_method POSTs
// { method, docs: <JSON>, args: <JSON> } with the doctype echoed in the
// X-Frappe-Doctype header; the mutated doc comes back at `docs[0]` and the
// method's scalar return value at `message`.
const RECON_DOCTYPE = encodeURIComponent("Payment Reconciliation")

interface RunMethodBody {
  docs?: Array<PaymentReconciliationWorkspace | null>
  message?: unknown
  _server_messages?: unknown
}

async function runReconMethod(
  method: string,
  doc: Record<string, unknown>,
  args?: Record<string, unknown>
): Promise<RunMethodBody> {
  const params: Record<string, unknown> = { method, docs: JSON.stringify(doc) }
  if (args !== undefined && Object.keys(args).length > 0) {
    params.args = JSON.stringify(args)
  }
  return postMethodRaw<RunMethodBody>("run_doc_method", params, {
    "x-frappe-doctype": RECON_DOCTYPE,
  })
}

function workspaceFrom(body: RunMethodBody, fallback: Record<string, unknown>): PaymentReconciliationWorkspace {
  const doc = body.docs?.[0]
  if (doc) return doc
  if (body.message && typeof body.message === "object") return body.message as PaymentReconciliationWorkspace
  return fallback as unknown as PaymentReconciliationWorkspace
}

export interface ReconFetchResult {
  workspace: PaymentReconciliationWorkspace
  messages: AppMessage[]
}

// get_unreconciled_entries — re-pulls payments[] + invoices[] for the
// configured party/account; ERPNext empty-state throws arrive as server
// messages (e.g. "No Unreconciled Invoices and Payments found ...").
export async function getUnreconciledEntries(doc: Record<string, unknown>): Promise<ReconFetchResult> {
  const body = await runReconMethod("get_unreconciled_entries", doc)
  return { workspace: workspaceFrom(body, doc), messages: serverMessagesFromBody(body) }
}

// allocate_entries — waterfall-allocates the selected payments against the
// selected invoices (in ERPNext order) and fills the allocation child table.
export async function allocateReconciliationEntries(
  doc: Record<string, unknown>,
  payments: ReconPaymentRow[],
  invoices: ReconInvoiceRow[]
): Promise<ReconFetchResult> {
  const body = await runReconMethod("allocate_entries", doc, { payments, invoices })
  return { workspace: workspaceFrom(body, doc), messages: serverMessagesFromBody(body) }
}

export interface ReconReconcileResult {
  workspace?: PaymentReconciliationWorkspace
  messages: AppMessage[]
}

// reconcile — posts the difference-account/journal-date values (set through
// the Difference dialog) on each allocation row, then reconciles.
export async function reconcileWorkspace(doc: Record<string, unknown>): Promise<ReconReconcileResult> {
  const body = await runReconMethod("reconcile", doc)
  return {
    workspace: body.docs?.[0] ?? undefined,
    messages: serverMessagesFromBody(body),
  }
}

// calculate_difference_on_allocation_change — recalcs a row's Difference
// Amount when the user edits an allocated amount (FX-aware in ERPNext; our
// single-currency books keep it as amount − allocated).
export async function calculateReconDifference(
  doc: Record<string, unknown>,
  paymentEntry: ReconPaymentRow,
  invoice: ReconInvoiceRow,
  allocatedAmount: number
): Promise<number> {
  const body = await runReconMethod("calculate_difference_on_allocation_change", doc, {
    payment_entry: paymentEntry,
    invoice,
    allocated_amount: allocatedAmount,
  })
  return Number(body.message ?? 0)
}

// is_auto_process_enabled — whether background auto-reconciliation is on; when
// true the form warns if a Process Payment Reconciliation job is running.
export async function isAutoReconcileEnabled(doc: Record<string, unknown>): Promise<boolean> {
  const body = await runReconMethod("is_auto_process_enabled", doc)
  return Boolean(body.message)
}

export interface PartyReconAccount {
  account: string
  advance_account: string
}

// erpnext.accounts.party.get_party_account (include_advance=1) — auto-fills
// Receivable/Payable Account + Default Advance Account on party selection.
export async function getPartyReconciliationAccount(
  company: string,
  partyType: string,
  party: string
): Promise<PartyReconAccount | null> {
  const result = await postMethod<unknown>("erpnext.accounts.party.get_party_account", {
    company,
    party_type: partyType,
    party,
    include_advance: 1,
  })
  if (Array.isArray(result)) {
    return {
      account: String(result[0] ?? ""),
      advance_account: String(result[1] ?? ""),
    }
  }
  if (typeof result === "string" && result) {
    return { account: result, advance_account: "" }
  }
  return null
}

// payment_reconciliation.get_queries_for_dimension_filters — filtered search
// sources for each configured accounting dimension.
export async function getDimensionFilters(company: string): Promise<Record<string, unknown>> {
  return postMethod<Record<string, unknown>>(
    "erpnext.accounts.doctype.payment_reconciliation.payment_reconciliation.get_queries_for_dimension_filters",
    { company }
  )
}

// process_payment_reconciliation.is_any_doc_running — the name of a running
// reconciliation job for the party (null when idle).
export async function isReconciliationJobRunning(filters: Record<string, unknown>): Promise<string | null> {
  const name = await postMethod<unknown>("process_payment_reconciliation.is_any_doc_running", {
    filters: JSON.stringify(filters),
  })
  if (!name) return null
  return typeof name === "string" ? name : String(name)
}

export type { PaymentReconciliationWorkspace, ReconAllocationRow, ReconInvoiceRow, ReconPaymentRow }

// Empty workspace used for the initial page state. The form's onload() clears
// party_type / party / receivable_payable_account and sets company.
export function emptyReconWorkspace(company: string): PaymentReconciliationWorkspace {
  return {
    doctype: "Payment Reconciliation",
    company,
    party_type: "",
    party: "",
    receivable_payable_account: "",
    default_advance_account: "",
    bank_cash_account: "",
    cost_center: "",
    project: "",
    from_posting_date: "",
    to_posting_date: "",
    min_payment_amount: 0,
    max_payment_amount: 0,
    payment_name: "",
    from_invoice_date: "",
    to_invoice_date: "",
    min_invoice_amount: 0,
    max_invoice_amount: 0,
    invoice_name: "",
    invoice_limit: 50,
    payment_limit: 50,
    payments: [],
    invoices: [],
    allocation: [],
  }
}