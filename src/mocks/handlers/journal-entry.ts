import { localDateISO } from "@/lib/utils"
import { http, HttpResponse, delay } from "msw"
import { matchesFilterSet, matchesFilter } from "./frappe-lookups"

// ── Journal Entry mock backend ──────────────────────────────────────
// Full ERPNext `Journal Entry` REST surface shared by the Expenses (M3.4)
// module and the Journal Entries module (pages extended in M3.6):
//   GET    /api/resource/Journal Entry                 → list (fields/filters/or_filters/order_by/limit)
//   GET    /api/resource/Journal Entry/:name           → single doc (accounts / totals / docstatus)
//   POST   /api/resource/Journal Entry                 → create
//   PUT    /api/resource/Journal Entry/:name           → update / submit
//   DELETE /api/resource/Journal Entry/:name           → delete
//   POST   frappe.desk.form.save.savedocs              → form create / save / submit
//   POST   frappe.desk.form.save.cancel                → cancel
//   POST   bulk_update.submit_cancel_or_update_docs    → bulk submit / cancel
//   POST   reportview.delete_items                     → bulk delete
//   POST   data_import.download_template               → export
//
// Child-table filters are supported the way ERPNext evaluates them: a tuple
// whose leading element is `accounts` (parent field) or `Journal Entry
// Account` (child doctype) matches a JE when any child row satisfies it.

export interface JournalEntryAccountRow extends Record<string, unknown> {
  name: string
  doctype: "Journal Entry Account"
  parentfield: "accounts"
  parenttype: "Journal Entry"
  parent: string
  idx: number
  account: string
  party_type?: string
  party?: string
  account_currency: string
  exchange_rate: number
  debit_in_account_currency: number
  credit_in_account_currency: number
  cost_center?: string
  project?: string
}

export interface JournalEntryStoreRow extends Record<string, unknown> {
  name: string
  doctype: "Journal Entry"
  title: string
  naming_series: string
  voucher_type: string
  company: string
  posting_date: string
  user_remark: string
  remark: string
  bill_no: string
  finance_book: string
  is_opening: number
  multi_currency: number
  total_debit: number
  total_credit: number
  difference: number
  status: string
  docstatus: number
  accounts: JournalEntryAccountRow[]
  owner: string
  creation: string
  modified: string
  modified_by: string
}

/** Account names treated as expense-side of a JE (root_type = Expense). */
export const EXPENSE_ACCOUNTS = [
  "Operating Expenses - BE",
  "Professional Services - BE",
  "Rent - BE",
  "Salaries - BE",
  "Travel - BE",
]

interface AccountSeed {
  account: string
  party_type?: string
  party?: string
  cost_center?: string
}

function accountsFor(
  parent: string,
  rows: Array<AccountSeed & { debit: number; credit: number }>,
): JournalEntryAccountRow[] {
  return rows.map((r, i) => ({
    name: `${parent}-ACC-${i + 1}`,
    doctype: "Journal Entry Account",
    parentfield: "accounts",
    parenttype: "Journal Entry",
    parent,
    idx: i + 1,
    account: r.account,
    party_type: r.party_type ?? "",
    party: r.party ?? "",
    account_currency: "CAD",
    exchange_rate: 1,
    debit_in_account_currency: r.debit,
    credit_in_account_currency: r.credit,
    cost_center: r.cost_center ?? "Main - BE",
    project: "",
  }))
}

interface JournalEntryFixture {
  name: string
  posting_date: string
  remark: string
  voucher_type: string
  docstatus: number
  status: string
  lines: Array<AccountSeed & { debit: number; credit: number }>
  creation: string
  modified: string
}

function fullDoc(seed: JournalEntryFixture): Record<string, unknown> {
  const accounts = accountsFor(seed.name, seed.lines)
  const totalDebit = Math.round(accounts.reduce((s, a) => s + a.debit_in_account_currency, 0) * 100) / 100
  const totalCredit = Math.round(accounts.reduce((s, a) => s + a.credit_in_account_currency, 0) * 100) / 100
  return {
    doctype: "Journal Entry",
    name: seed.name,
    title: seed.name,
    naming_series: "ACC-JV-.YYYY.-",
    voucher_type: seed.voucher_type,
    company: "Bless Erp",
    posting_date: seed.posting_date,
    posting_time: "00:00:00",
    user_remark: seed.remark,
    remark: seed.remark,
    bill_no: "",
    total_debit: totalDebit,
    total_credit: totalCredit,
    difference: Math.round((totalDebit - totalCredit) * 100) / 100,
    status: seed.status,
    docstatus: seed.docstatus,
    accounts,
    owner: "admin@blesserp.com",
    creation: seed.creation,
    modified: seed.modified,
    modified_by: "admin@blesserp.com",
    idx: 0,
  }
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const fixtureSeed: JournalEntryFixture[] = [
  {
    name: "ACC-JV-2026-00001", posting_date: "2026-09-10", remark: "Office supplies for Q3", voucher_type: "Journal Entry",
    docstatus: 1, status: "Submitted",
    lines: [
      { account: "Operating Expenses - BE", debit: 2500, credit: 0 },
      { account: "Cash - BE", debit: 0, credit: 2500 },
    ],
    creation: "2026-09-10 09:00:00", modified: "2026-09-10 09:05:00",
  },
  {
    name: "ACC-JV-2026-00002", posting_date: "2026-09-12", remark: "Accounting consultation - Deloitte LLP", voucher_type: "Journal Entry",
    docstatus: 0, status: "Draft",
    lines: [
      { account: "Professional Services - BE", debit: 1500, credit: 0, cost_center: "Operations - BE" },
      { account: "Cash - BE", debit: 0, credit: 1500, party_type: "Supplier", party: "SUP-00001" },
    ],
    creation: "2026-09-12 10:00:00", modified: "2026-09-12 10:00:00",
  },
  {
    name: "ACC-JV-2026-00003", posting_date: "2026-09-01", remark: "Rent for September", voucher_type: "Journal Entry",
    docstatus: 1, status: "Submitted",
    lines: [
      { account: "Rent - BE", debit: 5000, credit: 0 },
      { account: "Cheque - BE", debit: 0, credit: 5000 },
    ],
    creation: "2026-09-01 08:30:00", modified: "2026-09-01 08:40:00",
  },
  {
    name: "ACC-JV-2026-00004", posting_date: "2026-09-08", remark: "GST remittance", voucher_type: "Bank Entry",
    docstatus: 0, status: "Draft",
    lines: [
      { account: "GST - BE", debit: 0, credit: 1245 },
      { account: "Cash - BE", debit: 1245, credit: 0, party_type: "Supplier", party: "SUP-00002" },
    ],
    creation: "2026-09-08 14:00:00", modified: "2026-09-08 14:00:00",
  },
  {
    name: "ACC-JV-2026-00005", posting_date: "2026-08-28", remark: "Vehicle fuel reimbursement", voucher_type: "Journal Entry",
    docstatus: 2, status: "Cancelled",
    lines: [
      { account: "Travel - BE", debit: 320, credit: 0 },
      { account: "Cash - BE", debit: 0, credit: 320 },
    ],
    creation: "2026-08-28 16:00:00", modified: "2026-08-29 09:00:00",
  },
]

function cloneRow(row: JournalEntryStoreRow): JournalEntryStoreRow {
  return {
    ...row,
    accounts: ((row.accounts as unknown[]) ?? []).map((a) => ({
      ...(a as Record<string, unknown>),
    })) as unknown as JournalEntryAccountRow[],
  }
}

function newRow(payload: Record<string, unknown>, action: string): JournalEntryStoreRow {
  const submitted = action === "Submit" || Number(payload.docstatus) === 1
  const stamp = nowStamp()
  const parent = String(payload.name && payload.name !== "new-journal-entry" ? payload.name : "")
  const postingDate = String(payload.posting_date ?? localDateISO(new Date()))
  const remark = String(payload.remark ?? payload.user_remark ?? "")
  const rawAccounts = Array.isArray(payload.accounts) ? (payload.accounts as Record<string, unknown>[]) : []
  const accounts = rawAccounts.map((a, i) => ({
    doctype: "Journal Entry Account",
    parentfield: "accounts",
    parenttype: "Journal Entry",
    parent,
    idx: i + 1,
    name: String(a.name ?? `${parent}-ACC-${i + 1}`),
    account: String(a.account ?? ""),
    party_type: String(a.party_type ?? a.party ?? ""),
    party: String(a.party ?? ""),
    account_currency: String(a.account_currency ?? "CAD"),
    exchange_rate: Number(a.exchange_rate) || 1,
    debit_in_account_currency: Number(a.debit_in_account_currency ?? a.debit ?? 0),
    credit_in_account_currency: Number(a.credit_in_account_currency ?? a.credit ?? 0),
    cost_center: String(a.cost_center ?? "Main - BE"),
    project: String(a.project ?? ""),
  })) as JournalEntryAccountRow[]
  const totalDebit = round2(accounts.reduce((s, a) => s + a.debit_in_account_currency, 0))
  const totalCredit = round2(accounts.reduce((s, a) => s + a.credit_in_account_currency, 0))
  return {
    doctype: "Journal Entry",
    name: parent,
    title: String(payload.title ?? ""),
    naming_series: String(payload.naming_series ?? "ACC-JV-.YYYY.-"),
    voucher_type: String(payload.voucher_type ?? "Journal Entry"),
    company: String(payload.company ?? "Bless Erp"),
    posting_date: postingDate,
    posting_time: String(payload.posting_time ?? "00:00:00"),
    user_remark: remark,
    remark: String(payload.remark ?? ""),
    bill_no: String(payload.bill_no ?? ""),
    total_debit: totalDebit,
    total_credit: totalCredit,
    difference: round2(totalDebit - totalCredit),
    status: submitted ? "Submitted" : "Draft",
    docstatus: submitted ? 1 : 0,
    accounts,
    owner: "admin@blesserp.com",
    creation: String(payload.creation ?? stamp),
    modified: stamp,
    modified_by: "admin@blesserp.com",
    finance_book: String(payload.finance_book ?? ""),
    is_opening: Number(payload.is_opening ?? 0),
    multi_currency: Number(payload.multi_currency ?? 0),
  }
}

let store: JournalEntryStoreRow[] = fixtureSeed.map((s) => fullDoc(s) as unknown as JournalEntryStoreRow)
let jeCounter = fixtureSeed.length + 1

// Snapshot used by server.ts (shared test server) on resetFixtures.
export const initialJournalEntries = store.map(cloneRow)

export function journalEntryStore(): JournalEntryStoreRow[] {
  return store
}

export function resetJournalEntries(): void {
  store = initialJournalEntries.map(cloneRow)
  jeCounter = fixtureSeed.length + 1
}

/** True when a child-table filter tuple matches any `accounts` child row. */
function childMatches(
  row: Record<string, unknown>,
  childField: string,
  op: string,
  value: unknown,
): boolean {
  const rows = Array.isArray(row.accounts) ? (row.accounts as unknown[]) : []
  return rows.some((c) => matchesFilter(c as Record<string, unknown>, [[childField, op, value]]))
}

export function journalEntryMatches(
  row: Record<string, unknown>,
  filters: unknown[],
  orFilters: unknown[] = [],
): boolean {
  const flat: unknown[] = []
  const child: unknown[][] = []
  for (const f of filters) {
    if (Array.isArray(f) && f[0] === "accounts") child.push([f[1], f[2], f[3]])
    else if (Array.isArray(f) && f[0] === "Journal Entry Account") child.push([f[1], f[2], f[3]])
    else flat.push(f)
  }
  if (!matchesFilterSet(row, flat, [], "Journal Entry")) return false
  for (const [field, op, value] of child) {
    if (!childMatches(row, String(field), String(op), value)) return false
  }
  if (orFilters.length > 0) {
    const anyMatches = orFilters.some((f) => {
      const tuple = Array.isArray(f) ? (f as unknown[]) : []
      if (tuple[0] === "accounts" || tuple[0] === "Journal Entry Account") {
        return childMatches(row, String(tuple[1]), String(tuple[2]), tuple[3])
      }
      return matchesFilterSet(row, [tuple], [], "Journal Entry")
    })
    if (!anyMatches) return false
  }
  return true
}

export function countJournalEntries(filters: unknown[], orFilters: unknown[] = []): number {
  return store.filter((r) => journalEntryMatches(r, filters, orFilters)).length
}

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  try { return JSON.parse(value ?? "") as T } catch { return fallback }
}

function nowStamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19)
}

function parseForm(request: Request): Promise<Record<string, unknown>> {
  return request.formData().catch(() => new FormData()).then((fd) => {
    const out: Record<string, unknown> = {}
    fd.forEach((value, key) => { out[key] = value })
    return out
  })
}

function parseQSParams(url: string): {
  filters: unknown[]
  orFilters: unknown[]
  orderBy: string
  limitPageLength: number
  limitStart: number
} {
  const qp = new URL(url).searchParams
  const safe = (raw: string | null): unknown[] => (raw ? safeJson(raw, []) as unknown[] : [])
  return {
    filters: safe(qp.get("filters")),
    orFilters: safe(qp.get("or_filters")),
    orderBy: String(qp.get("order_by") ?? ""),
    limitPageLength: Number(qp.get("limit_page_length")) || 0,
    limitStart: Number(qp.get("limit_start")) || 0,
  }
}

const NEXT_SERIES = (): string => `ACC-JV-2026-${String(jeCounter).padStart(5, "0")}`

export const journalEntryHandlers = [
  // ── List: GET /api/resource/Journal Entry ─────────────────────────
  http.get("/api/resource/Journal Entry", async ({ request }) => {
    await delay(150)
    const { filters, orFilters, orderBy, limitPageLength, limitStart } = parseQSParams(request.url)
    let rows = filters.length > 0 || orFilters.length > 0
      ? store.filter((r) => journalEntryMatches(r, filters, orFilters))
      : [...store]
    if (orderBy) {
      const [field, dir] = orderBy.trim().split(/\s+/, 2)
      const mult = (dir ?? "desc").toLowerCase() === "asc" ? 1 : -1
      rows = [...rows].sort((a, b) => {
        const av = a[field]
        const bv = b[field]
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * mult
        return String(av ?? "").localeCompare(String(bv ?? "")) * mult
      })
    }
    if (limitPageLength > 0) rows = rows.slice(limitStart, limitStart + limitPageLength)
    return HttpResponse.json({ data: rows })
  }),

  // ── Single doc: GET /api/resource/Journal Entry/:name ─────────────
  http.get("/api/resource/Journal Entry/:name", async ({ params }) => {
    await delay(120)
    const row = store.find((r) => String(r.name) === params.name)
    if (!row) return HttpResponse.json({ message: `Journal Entry ${String(params.name)} not found` }, { status: 404 })
    return HttpResponse.json({ data: row })
  }),

  // ── Create: POST /api/resource/Journal Entry ──────────────────────
  http.post("/api/resource/Journal Entry", async ({ request }) => {
    await delay(200)
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const row = newRow(payload, "Save")
    store = [row, ...store]
    return HttpResponse.json({ data: row }, { status: 201 })
  }),

  // ── Update / submit: PUT /api/resource/Journal Entry/:name ────────
  http.put("/api/resource/Journal Entry/:name", async ({ params, request }) => {
    await delay(150)
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const idx = store.findIndex((r) => String(r.name) === params.name)
    if (idx === -1) return HttpResponse.json({ message: `Journal Entry ${String(params.name)} not found` }, { status: 404 })
    const prev = store[idx]
    const rebuilt = newRow({ ...prev, ...payload, name: prev.name }, "Save")
    const next: Record<string, unknown> = { ...rebuilt }
    if (payload.docstatus === 1 && Number(prev.docstatus) === 0) {
      next.docstatus = 1
      next.status = "Submitted"
    }
    store[idx] = next as JournalEntryStoreRow
    return HttpResponse.json({ data: store[idx] })
  }),

  // ── Delete: DELETE /api/resource/Journal Entry/:name ──────────────
  http.delete("/api/resource/Journal Entry/:name", async ({ params }) => {
    await delay(150)
    store = store.filter((r) => String(r.name) !== params.name)
    return HttpResponse.json({ message: "ok" })
  }),

  // ── Save / Submit / Update: frappe.desk.form.save.savedocs ────────
  http.post("/api/method/frappe.desk.form.save.savedocs", async ({ request }) => {
    await delay(150)
    const fields = await parseForm(request)
    const payload = safeJson(String(fields.doc ?? ""), {}) as Record<string, unknown>
    const docDoctype = String(payload.doctype ?? fields.doctype ?? "Journal Entry")
    // Non-JE savedocs falls through to the purchase form handlers.
    if (docDoctype !== "" && docDoctype !== "Journal Entry") return undefined
    const action = String(fields.action ?? "Save")
    const merged = { ...payload }
    if (merged.name === "" || merged.name === "new-journal-entry") {
      const nextName = NEXT_SERIES()
      jeCounter += 1
      merged.name = nextName
    }
    const row = newRow({ ...merged, name: merged.name }, action)
    const exists = store.some((r) => String(r.name) === String(merged.name))
    if (exists) {
      const idx = store.findIndex((r) => String(r.name) === String(merged.name))
      store[idx] = { ...store[idx], ...row } as JournalEntryStoreRow
    } else {
      store = [row, ...store]
    }
    const doc = store.find((r) => String(r.name) === String(merged.name))
    return HttpResponse.json({ message: "Saved", docs: [doc] })
  }),

  // ── Cancel: frappe.desk.form.save.cancel ──────────────────────────
  http.post("/api/method/frappe.desk.form.save.cancel", async ({ request }) => {
    await delay(150)
    const fields = await parseForm(request)
    const doctype = String(fields.doctype ?? "")
    if (doctype.length > 0 && doctype !== "Journal Entry") return undefined
    const name = String(fields.name ?? fields.docname ?? "")
    const idx = store.findIndex((r) => String(r.name) === name)
    if (idx === -1) return HttpResponse.json({ message: `Journal Entry ${name} not found` }, { status: 404 })
    const row = store[idx]
    if (Number(row.docstatus) !== 1) {
      return HttpResponse.json({
        message: `Journal Entry ${name} cannot be cancelled because it is not submitted`,
        _server_messages: JSON.stringify([
          { message: `Journal Entry ${name} cannot be cancelled because it is not submitted`, title: "Message", indicator: "red", raise_exception: 1 },
        ]),
      }, { status: 417 })
    }
    store[idx] = { ...row, docstatus: 2, status: "Cancelled", modified: nowStamp() } as JournalEntryStoreRow
    return HttpResponse.json({ message: "Cancelled" })
  }),

  // ── Bulk submit/cancel via bulk_update ────────────────────────────
  http.post("/api/method/frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", async ({ request }) => {
    await delay(150)
    const body = await parseForm(request)
    if (body.doctype !== undefined && body.doctype !== "Journal Entry") return undefined
    const names = safeJson(String(body.docnames ?? "[]"), []) as string[]
    const action = body.action ?? "submit"
    const failed: string[] = []
    for (const name of names) {
      const idx = store.findIndex((r) => String(r.name) === name)
      if (idx === -1) { failed.push(name); continue }
      const row = store[idx]
      if (action === "submit") {
        if (Number(row.docstatus) === 1) continue
        store[idx] = { ...row, docstatus: 1, status: "Submitted", modified: nowStamp() } as JournalEntryStoreRow
      } else if (action === "cancel") {
        if (Number(row.docstatus) === 2) continue
        store[idx] = { ...row, docstatus: 2, status: "Cancelled", modified: nowStamp() } as JournalEntryStoreRow
      }
    }
    if (failed.length > 0) return HttpResponse.json({ message: failed })
    return HttpResponse.json({ message: null })
  }),

  // ── Bulk delete via reportview.delete_items ───────────────────────
  http.post("/api/method/frappe.desk.reportview.delete_items", async ({ request }) => {
    await delay(150)
    const body = await parseForm(request)
    if (body.doctype !== undefined && body.doctype !== "Journal Entry") return undefined
    const items = safeJson(String(body.items ?? "[]"), []) as string[]
    const failed = items.filter((name) => !store.some((r) => String(r.name) === name))
    store = store.filter((r) => !items.includes(String(r.name)))
    if (failed.length > 0) return HttpResponse.json({ message: { undeleted_items: failed } })
    return HttpResponse.json({ message: null })
  }),

  // ── Export via data_import.download_template ─────────────────────
  http.post("/api/method/frappe.core.doctype.data_import.data_import.download_template", async ({ request }) => {
    await delay(200)
    const body = await parseForm(request)
    if (body.doctype !== undefined && body.doctype !== "Journal Entry") return undefined
    const doctype = String(body.doctype ?? "Journal Entry")
    const fields = safeJson(String(body.export_fields ?? "{}"), {}) as Record<string, string[]>
    const parentFields = (fields[doctype] ?? (fields["Journal Entry"] ?? ["name"])) as string[]
    const header = parentFields.join(",")
    const csv = `${header}\r\n${parentFields.map(() => "value").join(",")}\r\n`
    return new HttpResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    })
  }),
]