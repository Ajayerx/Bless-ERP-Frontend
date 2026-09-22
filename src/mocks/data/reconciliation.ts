// Shared in-memory mock backend for the Payment Reconciliation workspace.
//
// Both the node test server (src/mocks/server.ts) and the browser worker
// (src/mocks/handlers/reconciliation.ts) dispatch to the pure functions in
// this module, so the Desk-exact flows behave identically in tests and in
// MOCK_MODE dev. It is intentionally framework-free (no MSW, no React).
//
// ERPNext source mirrored:
//   erpnext/accounts/doctype/payment_reconciliation/payment_reconciliation.py
//     validate_mandatory / get_invoices / get_payments / allocate_entries /
//     reconcile / calculate_difference_on_allocation_change

import { removeBankTransactionPaymentEntries } from "./bank_reconciliation"

export interface ReconInvoice {
  invoice_type: "Sales Invoice" | "Purchase Invoice"
  invoice_number: string
  party_type: "Customer" | "Supplier"
  party: string
  invoice_date: string
  amount: number
  outstanding_amount: number
}

export interface ReconPayment {
  reference_type: "Payment Entry" | "Journal Entry"
  reference_name: string
  party_type: "Customer" | "Supplier"
  party: string
  posting_date: string
  amount: number
  difference_amount: number
  reconciled: number
  cost_center?: string
}

export interface ReconciliationState {
  company: string
  currency: string
  invoiceAccount: { Customer: string; Supplier: string }
  defaultAdvanceReceived: string
  defaultAdvancePaid: string
  invoices: ReconInvoice[]
  payments: ReconPayment[]
  autoProcessEnabled: boolean
  runningJob: string | null
  dimensionFilters: Record<string, unknown>
  reconciledJournalEntries: Array<{ name: string; amount: number; account: string }>
}

const DEFAULT_INVOICES: ReconInvoice[] = [
  { invoice_type: "Sales Invoice", invoice_number: "ACC-SINV-2026-00031", party_type: "Customer", party: "AlphaCorp", invoice_date: "2026-09-01", amount: 1500, outstanding_amount: 1500 },
  { invoice_type: "Sales Invoice", invoice_number: "ACC-SINV-2026-00032", party_type: "Customer", party: "AlphaCorp", invoice_date: "2026-09-10", amount: 900, outstanding_amount: 900 },
  { invoice_type: "Sales Invoice", invoice_number: "ACC-SINV-2026-00033", party_type: "Customer", party: "BetaInc", invoice_date: "2026-08-20", amount: 2000, outstanding_amount: 2000 },
  { invoice_type: "Purchase Invoice", invoice_number: "ACC-PINV-2026-00021", party_type: "Supplier", party: "VendorOne", invoice_date: "2026-08-15", amount: 3000, outstanding_amount: 3000 },
  { invoice_type: "Purchase Invoice", invoice_number: "ACC-PINV-2026-00022", party_type: "Supplier", party: "VendorTwo", invoice_date: "2026-09-05", amount: 1200, outstanding_amount: 1200 },
]

const DEFAULT_PAYMENTS: ReconPayment[] = [
  { reference_type: "Payment Entry", reference_name: "ACC-PAY-2026-00051", party_type: "Customer", party: "AlphaCorp", posting_date: "2026-09-02", amount: 1500, difference_amount: 0, reconciled: 0, cost_center: "Main - BE" },
  { reference_type: "Payment Entry", reference_name: "ACC-PAY-2026-00052", party_type: "Customer", party: "AlphaCorp", posting_date: "2026-09-12", amount: 900, difference_amount: 0, reconciled: 0, cost_center: "Main - BE" },
  { reference_type: "Payment Entry", reference_name: "ACC-PAY-2026-00053", party_type: "Customer", party: "BetaInc", posting_date: "2026-08-25", amount: 1800, difference_amount: 0, reconciled: 0, cost_center: "Main - BE" },
  { reference_type: "Journal Entry", reference_name: "ACC-JV-2026-00012", party_type: "Customer", party: "BetaInc", posting_date: "2026-08-27", amount: 412.5, difference_amount: 0, reconciled: 0, cost_center: "Main - BE" },
  { reference_type: "Payment Entry", reference_name: "ACC-PAY-2026-00054", party_type: "Supplier", party: "VendorOne", posting_date: "2026-08-20", amount: 3000, difference_amount: 0, reconciled: 0, cost_center: "Main - BE" },
  { reference_type: "Payment Entry", reference_name: "ACC-PAY-2026-00055", party_type: "Supplier", party: "VendorTwo", posting_date: "2026-09-08", amount: 1200, difference_amount: 0, reconciled: 0, cost_center: "Main - BE" },
]

export const reconState: ReconciliationState = {
  company: "Bless Erp",
  currency: "CAD",
  invoiceAccount: { Customer: "Debtors - BE", Supplier: "Creditors - BE" },
  defaultAdvanceReceived: "Advances Received - BE",
  defaultAdvancePaid: "Advances Paid - BE",
  invoices: DEFAULT_INVOICES.map((i) => ({ ...i })),
  payments: DEFAULT_PAYMENTS.map((p) => ({ ...p })),
  autoProcessEnabled: true,
  runningJob: null,
  dimensionFilters: {},
  reconciledJournalEntries: [],
}

export function resetReconciliationFixtures(): void {
  reconState.invoices = DEFAULT_INVOICES.map((i) => ({ ...i }))
  reconState.payments = DEFAULT_PAYMENTS.map((p) => ({ ...p }))
  reconState.autoProcessEnabled = true
  reconState.runningJob = null
  reconState.dimensionFilters = {}
  reconState.reconciledJournalEntries = []
}

// Test-hook mirroring the Process Payment Reconciliation background job.
export function setReconJobRunning(name: string | null): void {
  reconState.runningJob = name
}

export interface ReconAllocation {
  reference_type: string
  reference_name: string
  posting_date: string
  amount: number
  invoice_type: string
  invoice_number: string
  invoice_date: string
  outstanding_amount: number
  allocated_amount: number
  difference_amount: number
  exchange_rate: number
  difference_account: string
  gain_loss_posting_date: string
}

export interface MockResponse {
  body: Record<string, unknown>
  status?: number
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
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

function serverMessage(message: string, indicator = "red"): Record<string, unknown> {
  return {
    _server_messages: JSON.stringify([{ message, title: "Message", indicator }]),
  }
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value)
}

function inRange(value: string, from: unknown, to: unknown): boolean {
  const f = text(from)
  const t = text(to)
  if (f && value < f) return false
  if (t && value > t) return false
  return true
}

function withinAmount(value: number, min: unknown, max: unknown): boolean {
  const lo = Number(min ?? 0)
  const hi = Number(max ?? 0)
  if (lo && value < lo) return false
  if (hi && value > hi) return false
  return true
}

// validate_mandatory — verbatim ERPNext field labels.
export function validateReconMandatory(doc: Record<string, unknown>): void {
  const required: Array<[string, string]> = [
    ["company", "Company"],
    ["party_type", "Party Type"],
    ["party", "Party"],
    ["receivable_payable_account", "Receivable / Payable Account"],
  ]
  for (const [field, label] of required) {
    if (!text(doc[field])) throw new Error(`${label} is required`)
  }
}

export function getReconInvoices(doc: Record<string, unknown>): Array<Record<string, unknown>> {
  const partyType = text(doc.party_type)
  const party = text(doc.party)
  const name = text(doc.invoice_name).toLowerCase()
  const limit = Number(doc.invoice_limit ?? 0)
  let rows = reconState.invoices.filter(
    (i) => i.party_type === partyType && i.party === party && i.outstanding_amount > 0
  )
  rows = rows.filter(
    (i) =>
      inRange(i.invoice_date, doc.from_invoice_date, doc.to_invoice_date) &&
      withinAmount(i.outstanding_amount, doc.min_invoice_amount, doc.max_invoice_amount) &&
      (!name || i.invoice_number.toLowerCase().includes(name))
  )
  if (limit > 0) rows = rows.slice(0, limit)
  return rows.map((i) => ({
    invoice_type: i.invoice_type,
    invoice_number: i.invoice_number,
    invoice_date: i.invoice_date,
    amount: i.amount,
    outstanding_amount: i.outstanding_amount,
  }))
}

export function getReconPayments(doc: Record<string, unknown>): Array<Record<string, unknown>> {
  const partyType = text(doc.party_type)
  const party = text(doc.party)
  const name = text(doc.payment_name).toLowerCase()
  const limit = Number(doc.payment_limit ?? 0)
  let rows = reconState.payments.filter(
    (p) => p.party_type === partyType && p.party === party && p.amount - p.reconciled > 0
  )
  rows = rows.filter(
    (p) =>
      inRange(p.posting_date, doc.from_posting_date, doc.to_posting_date) &&
      withinAmount(p.amount - p.reconciled, doc.min_payment_amount, doc.max_payment_amount) &&
      (!name || p.reference_name.toLowerCase().includes(name))
  )
  if (limit > 0) rows = rows.slice(0, limit)
  return rows.map((p) => ({
    reference_type: p.reference_type,
    reference_name: p.reference_name,
    posting_date: p.posting_date,
    amount: round2(p.amount - p.reconciled),
    difference_amount: p.difference_amount,
    cost_center: p.cost_center ?? "",
  }))
}

// get_unreconciled_entries — pulls payments[] + invoices[] and attaches the
// ERPNext empty-state messages.
export function runGetUnreconciled(doc: Record<string, unknown>): MockResponse {
  try {
    validateReconMandatory(doc)
  } catch (e) {
    return { body: serverMessage((e as Error).message), status: 417 }
  }

  const payments = getReconPayments(doc)
  const invoices = getReconInvoices(doc)
  let message: string | null = null
  if (payments.length === 0 && invoices.length === 0) {
    message = "No Unreconciled Invoices and Payments found for this party and account"
  } else if (invoices.length === 0) {
    message = "No Outstanding Invoices found for this party"
  } else if (payments.length === 0) {
    message = "No Unreconciled Payments found for this party"
  }

  const refreshed = { ...doc, payments, invoices, allocation: [] }
  const body: Record<string, unknown> = { docs: [refreshed] }
  if (message) {
    body._server_messages = JSON.stringify([{ message, title: "Message", indicator: "orange" }])
  }
  return { body }
}

// allocate_entries — ERPNext's single-pass waterfall: each payment (in order)
// fills invoices (in order) until exhausted; any payment remainder is booked
// as that row's difference_amount.
export function runAllocateEntries(
  doc: Record<string, unknown>,
  args: Record<string, unknown>
): MockResponse {
  const payments = parseJson<Array<Record<string, unknown>>>(args.payments, [])
  const invoices = parseJson<Array<Record<string, unknown>>>(args.invoices, [])
  if (payments.length === 0 || invoices.length === 0) {
    return {
      body: serverMessage("Please select at least one payment and one invoice to allocate."),
      status: 417,
    }
  }

  const outstanding = invoices.map((i) => ({
    invoice_type: text(i.invoice_type),
    invoice_number: text(i.invoice_number),
    invoice_date: text(i.invoice_date),
    outstanding_amount: Number(i.outstanding_amount ?? 0),
    remaining: Number(i.outstanding_amount ?? 0),
  }))

  const allocation: ReconAllocation[] = []
  let index = 0
  for (const payment of payments) {
    let remainingPayment = Number(payment.amount ?? 0)
    let lastRow: ReconAllocation | null = null
    while (remainingPayment > 0 && index < outstanding.length) {
      const invoice = outstanding[index]
      const take = round2(Math.min(invoice.remaining, remainingPayment))
      if (take <= 0) {
        index += 1
        continue
      }
      invoice.remaining = round2(invoice.remaining - take)
      remainingPayment = round2(remainingPayment - take)
      const row: ReconAllocation = {
        reference_type: text(payment.reference_type),
        reference_name: text(payment.reference_name),
        posting_date: text(payment.posting_date),
        amount: Number(payment.amount ?? 0),
        invoice_type: invoice.invoice_type,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        outstanding_amount: invoice.outstanding_amount,
        allocated_amount: take,
        difference_amount: Number(payment.difference_amount ?? 0),
        exchange_rate: 1,
        difference_account: "",
        gain_loss_posting_date: "",
      }
      allocation.push(row)
      lastRow = row
      if (invoice.remaining <= 0) index += 1
    }
    if (lastRow && remainingPayment > 0) {
      lastRow.difference_amount = round2(lastRow.difference_amount + remainingPayment)
    }
  }

  const refreshed = { ...doc, payments, invoices, allocation }
  return { body: { docs: [refreshed] } }
}

// calculate_difference_on_allocation_change — single-currency books keep the
// difference as the payment's unallocated remainder.
export function runCalculateDifference(args: Record<string, unknown>): MockResponse {
  const payment = parseJson<Record<string, unknown>>(args.payment_entry, {})
  const amount = Number(payment.amount ?? 0)
  const allocated = Number(args.allocated_amount ?? 0)
  return { body: { message: round2(amount - allocated) } }
}

// reconcile — posts Journal Entries for difference rows (requires a
// difference_account per ERPNext validate) then settles the fixture ledger.
export function runReconcile(doc: Record<string, unknown>): MockResponse {
  const allocation = parseJson<ReconAllocation[]>(doc.allocation, [])
  const differenceRows = allocation.filter((r) => Number(r.difference_amount ?? 0) !== 0)
  const missingAccount = differenceRows.some((r) => !text(r.difference_account))
  if (missingAccount) {
    return {
      body: serverMessage(
        "Some of the reconciliation entries have a difference_amount, please make sure that all such entries are posted."
      ),
      status: 417,
    }
  }

  for (const row of differenceRows) {
    reconState.reconciledJournalEntries.push({
      name: `ACC-JV-2026-90${reconState.reconciledJournalEntries.length + 1}`,
      amount: round2(Math.abs(Number(row.difference_amount))),
      account: text(row.difference_account),
    })
  }

  for (const row of allocation) {
    const invoice = reconState.invoices.find((i) => i.invoice_number === row.invoice_number)
    if (invoice) {
      invoice.outstanding_amount = round2(Math.max(0, invoice.outstanding_amount - Number(row.allocated_amount)))
    }
    const payment = reconState.payments.find((p) => p.reference_name === row.reference_name)
    if (payment) {
      payment.reconciled = round2(Math.min(payment.amount, payment.reconciled + Number(row.allocated_amount)))
    }
  }

  const refreshed = {
    ...doc,
    payments: getReconPayments(doc),
    invoices: getReconInvoices(doc),
    allocation: [],
  }
  return {
    body: {
      docs: [refreshed],
      _server_messages: JSON.stringify([
        { message: "Successfully Reconciled", title: "Message", indicator: "green" },
      ]),
    },
  }
}

// erpnext.accounts.party.get_party_account(include_advance=1)
export function getReconPartyAccount(partyType: string, party: string): unknown {
  if (!partyType || !party) return []
  const known =
    reconState.invoices.some((i) => i.party === party) ||
    reconState.payments.some((p) => p.party === party)
  if (!known) return []
  const account = partyType === "Customer" ? reconState.invoiceAccount.Customer : reconState.invoiceAccount.Supplier
  const advance = partyType === "Customer" ? reconState.defaultAdvanceReceived : reconState.defaultAdvancePaid
  return [account, advance]
}

// Payment Entry's allocate_amount_to_references (unchanged behavior).
export function allocatePaymentEntryReferences(
  doc: Record<string, unknown>,
  args: Record<string, unknown>
): Record<string, unknown> {
  const refs = Array.isArray(doc.references)
    ? (doc.references as Array<Record<string, unknown>>).map((r) => ({ ...r }))
    : []
  const allocate = args.allocate_payment_amount !== false
  let remaining = Math.max(0, Number(args.paid_amount ?? doc.paid_amount ?? 0))
  for (const ref of refs) {
    if (!allocate) {
      ref.allocated_amount = 0
      continue
    }
    const outstanding = Number(ref.outstanding_amount ?? 0)
    if (outstanding > 0 && remaining > 0) {
      const allocated = Math.min(outstanding, remaining)
      ref.allocated_amount = allocated
      remaining -= allocated
    } else {
      ref.allocated_amount = 0
    }
  }
  return { ...doc, references: refs }
}

// Dispatch for /api/method/run_doc_method. Unknown methods fall through to the
// historic behavior (echo the doc unchanged at docs[0]).
export function dispatchRunDocMethod(payload: {
  method: string
  docs: unknown
  args: unknown
}): MockResponse {
  const doc = parseJson<Record<string, unknown>>(payload.docs, {})
  const args = parseJson<Record<string, unknown>>(payload.args, {})
  switch (payload.method) {
    case "get_unreconciled_entries":
      return runGetUnreconciled(doc)
    case "allocate_entries":
      return runAllocateEntries(doc, args)
    case "reconcile":
      return runReconcile(doc)
    case "calculate_difference_on_allocation_change":
      return runCalculateDifference(args)
    case "is_auto_process_enabled":
      return { body: { message: reconState.autoProcessEnabled } }
    case "allocate_amount_to_references":
      return { body: { docs: [allocatePaymentEntryReferences(doc, args)] } }
    case "remove_payment_entries":
      return removeBankTransactionPaymentEntries(doc)
    default:
      return { body: { docs: [doc] } }
  }
}