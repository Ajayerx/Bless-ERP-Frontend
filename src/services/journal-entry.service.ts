import { apiClient } from "./api-client"
import {
  buildDocListUrl,
  getDocList,
  getDocCount,
  postMethodRaw,
} from "./frappe-client"
import { serverDownloadTemplate, serverMessagesFromBody, type AppMessage } from "./api-client"
import { getCompanyDefaults } from "./company"
import { todayISO } from "@/lib/utils"

export const JOURNAL_ENTRY_DOCTYPE = "Journal Entry"

// ── Types ──────────────────────────────────────────────────────────────
export interface JournalEntryAccountRow {
  doctype?: "Journal Entry Account"
  name?: string
  parentfield?: "accounts"
  parenttype?: "Journal Entry"
  parent?: string
  idx?: number
  account: string
  account_type?: string
  party_type?: string
  party?: string
  debit_in_account_currency: number
  credit_in_account_currency: number
  account_currency?: string
  exchange_rate?: number
  cost_center?: string
  project?: string
}

export interface JournalEntryDoc {
  doctype: "Journal Entry"
  name: string
  title?: string
  voucher_type: string
  posting_date: string
  posting_time?: string
  company: string
  remark?: string
  user_remark?: string
  bill_no?: string
  total_debit: number
  total_credit: number
  difference?: number
  status?: string
  docstatus: number
  naming_series?: string
  accounts: JournalEntryAccountRow[]
  owner?: string
  creation?: string
  modified?: string
  modified_by?: string
}

export type JournalEntryStatus = "draft" | "submitted" | "cancelled"

/** Decorated expense view row (M3.4 list / detail of expense-type JEs). */
export interface ExpenseRow {
  id: string
  name: string
  title: string
  postingDate: string
  company: string
  voucherType: string
  expenseAccount: string
  expenseAmount: number
  paidFrom: string
  partyType: string
  party: string
  remark: string
  userRemark: string
  docstatus: number
  status: JournalEntryStatus
  totalDebit: number
  totalCredit: number
  createdAt: string
  modified: string
}

export interface ExpenseListFilters {
  search?: string
  page?: number
  pageSize?: number
  account?: string
  company?: string
  postingDateFrom?: string
  postingDateTo?: string
  status?: JournalEntryStatus | "all"
  filters?: unknown[]
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export interface ExpenseListResponse {
  items: ExpenseRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ExpenseFormData {
  postingDate: string
  company: string
  remark: string
  userRemark?: string
  expenseAccount: string
  amount: number
  costCenter?: string
  project?: string
  supplier?: string
  paidFrom: string
}

// ── Wire / helpers ─────────────────────────────────────────────────────
const LIST_FIELDS = [
  "name", "title", "voucher_type", "posting_date", "posting_time",
  "company", "remark", "user_remark", "bill_no",
  "total_debit", "total_credit", "difference", "docstatus", "status",
  "accounts", "owner", "creation", "modified",
]

const dnum = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const ACCOUNT_MASTER_FILTER: unknown[] = [
  ["account_type", "=", "Expense Account"],
  ["is_group", "=", 0],
]

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

// ── Account / option lookups ───────────────────────────────────────────
async function listAccountNames(filters: unknown[]): Promise<string[]> {
  try {
    const rows = await apiClient<Array<{ name: string }>>(
      buildDocListUrl("Account", {
        fields: ["name", "account_type", "root_type", "is_group", "company"],
        filters,
        limitPageLength: 0,
        orderBy: "name asc",
      })
    )
    return (rows ?? []).map((r) => r.name)
  } catch {
    return []
  }
}

async function fetchExpenseAccounts(company?: string): Promise<string[]> {
  const filters = company ? [...ACCOUNT_MASTER_FILTER, ["company", "=", company]] : [...ACCOUNT_MASTER_FILTER]
  return listAccountNames(filters)
}

async function fetchPaidFromAccounts(company?: string): Promise<string[]> {
  const filters: unknown[] = [
    ["is_group", "=", 0],
    ["root_type", "=", "Asset"],
  ]
  if (company) filters.push(["company", "=", company])
  return listAccountNames(filters)
}

async function fetchCompanies(): Promise<string[]> {
  try {
    const rows = await getDocList<{ name: string }>("Company", {
      fields: ["name"],
      limitPageLength: 0,
      orderBy: "name asc",
    })
    return (rows ?? []).map((r) => r.name)
  } catch {
    return []
  }
}

export const journalEntryLookups = {
  expenseAccounts: (company?: string) => fetchExpenseAccounts(company),
  paidFromAccounts: (company?: string) => fetchPaidFromAccounts(company),
  companies: () => fetchCompanies(),
  costCenters: (company?: string) => listAccountNames(
    company ? [["is_group", "=", 0], ["company", "=", company]] : [["is_group", "=", 0]]
  ).catch(() => []),
}

const jeSearchLinkInFlight = new Map<string, Promise<Array<{ value: string; label: string; description: string }>>>()

/** search_link wire format for link fields (Account / Company / Owner). */
export async function searchLink(
  doctype: string,
  query: string,
  filters?: unknown[][],
): Promise<Array<{ value: string; label: string; description: string }>> {
  const qp = new URLSearchParams()
  qp.set("doctype", doctype)
  qp.set("txt", query)
  qp.set("ignore_user_permissions", "0")
  if (filters) qp.set("filters", JSON.stringify(filters))
  qp.set("page_length", "10")
  const url = `/method/frappe.desk.search.search_link?${qp.toString()}`
  const inflight = jeSearchLinkInFlight.get(url)
  if (inflight) return inflight
  const promise = apiClient<Array<{ value: string; label: string; description: string }>>(url).catch(() => [])
  jeSearchLinkInFlight.set(url, promise)
  promise.finally(() => {
    jeSearchLinkInFlight.delete(url)
  })
  return promise
}

// ── Status / decoration ────────────────────────────────────────────────
export function mapJournalEntryStatus(doc: Record<string, unknown>): JournalEntryStatus {
  if (dnum(doc.docstatus) === 2) return "cancelled"
  if (dnum(doc.docstatus) === 1) return "submitted"
  return "draft"
}

function decorateExpense(doc: Record<string, unknown>, expenseAccounts: string[]): ExpenseRow {
  const accounts = (Array.isArray(doc.accounts) ? (doc.accounts as Record<string, unknown>[]) : []).map(
    (a) => ({
      account: String(a.account ?? ""),
      party_type: String(a.party_type ?? ""),
      party: String(a.party ?? ""),
      debit: dnum(a.debit_in_account_currency ?? a.debit),
      credit: dnum(a.credit_in_account_currency ?? a.credit),
    })
  )
  const primary = accounts.find(
    (a) => expenseAccounts.includes(a.account) && a.debit > 0
  ) ?? accounts.find((a) => expenseAccounts.includes(a.account))
  const paidFrom = accounts.find((a) => a.debit === 0 && a.credit > 0)
  return {
    id: String(doc.name),
    name: String(doc.name),
    title: String(doc.title ?? ""),
    postingDate: String(doc.posting_date ?? ""),
    company: String(doc.company ?? ""),
    voucherType: String(doc.voucher_type ?? "Journal Entry"),
    expenseAccount: primary ? primary.account : "",
    expenseAmount: primary ? primary.debit : 0,
    paidFrom: paidFrom ? paidFrom.account : "",
    partyType: primary ? primary.party_type : "",
    party: primary ? primary.party : "",
    remark: String(doc.remark ?? ""),
    userRemark: String(doc.user_remark ?? ""),
    docstatus: dnum(doc.docstatus),
    status: mapJournalEntryStatus(doc),
    totalDebit: dnum(doc.total_debit),
    totalCredit: dnum(doc.total_credit),
    createdAt: String(doc.creation ?? doc.posting_date ?? ""),
    modified: String(doc.modified ?? ""),
  }
}

// ── Expense list (JE child-table filters) ──────────────────────────────
export async function listExpenses(params: ExpenseListFilters = {}): Promise<ExpenseListResponse> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  const limitStart = (page - 1) * pageSize
  const expenseAccounts = await fetchExpenseAccounts(params.company)

  const filters: unknown[] = []
  if (expenseAccounts.length > 0) filters.push(["accounts", "account", "in", expenseAccounts])
  if (params.account) filters.push(["accounts", "account", "=", params.account])
  if (params.company) filters.push(["Journal Entry", "company", "=", params.company])
  if (params.postingDateFrom) filters.push(["Journal Entry", "posting_date", ">=", params.postingDateFrom])
  if (params.postingDateTo) filters.push(["Journal Entry", "posting_date", "<=", params.postingDateTo])
  if (params.status && params.status !== "all") {
    const docstatus = params.status === "submitted" ? 1 : params.status === "cancelled" ? 2 : 0
    filters.push(["Journal Entry", "docstatus", "=", docstatus])
  }
  if (params.search) {
    const term = `%${params.search}%`
    filters.push([
      "OR",
      [["Journal Entry", "name", "like", term]],
      [["Journal Entry", "title", "like", term]],
      [["Journal Entry", "user_remark", "like", term]],
      [["Journal Entry", "remark", "like", term]],
    ])
  }
  if (params.filters && params.filters.length > 0) {
    for (const tuple of params.filters) {
      if (!Array.isArray(tuple) || tuple.length < 4) continue
      const [, field, op, val] = tuple as [string, string, string, unknown]
      // Child-table fields (account/party) need the `accounts.xxx` form.
      if (field === "account") filters.push(["accounts", "account", op, val])
      else if (field === "party") filters.push(["accounts", "party", op, val])
      else filters.push(tuple as unknown[])
    }
  }

  const orderBy = params.sortBy
    ? `${params.sortBy} ${params.sortOrder === "asc" ? "asc" : "desc"}`
    : "posting_date desc"

  const [rows, total] = await Promise.all([
    getDocList<Record<string, unknown>>("Journal Entry", {
      fields: LIST_FIELDS,
      filters,
      limitStart,
      limitPageLength: pageSize,
      orderBy,
    }),
    getDocCount("Journal Entry", filters),
  ])

  return {
    items: (rows ?? []).map((r) => decorateExpense(r, expenseAccounts)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

// ── Expense form → balanced 2-row Journal Entry draft ──────────────────
export function buildExpenseJE(form: ExpenseFormData): Record<string, unknown> {
  const postingDate = form.postingDate || todayISO()
  const amount = round2(Math.abs(dnum(form.amount)))
  const remark = String(form.remark ?? "").trim()
  const userRemark = String(form.userRemark ?? "").trim() || remark

  const debitRow: Record<string, unknown> = {
    doctype: "Journal Entry Account",
    account: form.expenseAccount,
    debit_in_account_currency: amount,
    credit_in_account_currency: 0,
    account_currency: "CAD",
    exchange_rate: 1,
  }
  if (form.costCenter) debitRow.cost_center = form.costCenter
  if (form.project) debitRow.project = form.project
  if (form.supplier) {
    debitRow.party_type = "Supplier"
    debitRow.party = form.supplier
  }

  const creditRow: Record<string, unknown> = {
    doctype: "Journal Entry Account",
    account: form.paidFrom,
    debit_in_account_currency: 0,
    credit_in_account_currency: amount,
    account_currency: "CAD",
    exchange_rate: 1,
  }

  return {
    doctype: "Journal Entry",
    voucher_type: "Journal Entry",
    posting_date: postingDate,
    posting_time: "00:00:00",
    company: form.company,
    remark,
    user_remark: userRemark,
    title: userRemark,
    bill_no: "",
    accounts: [debitRow, creditRow],
    total_debit: amount,
    total_credit: amount,
  }
}

// ── CRUD (shared with M3.6 journal entries) ────────────────────────────
export const journalEntryService = {
  lookups: journalEntryLookups,
  searchLink,
  listExpenses,

  async list(params: {
    search?: string
    status?: string
    filters?: unknown[]
    sortBy?: string
    sortOrder?: "asc" | "desc"
    page?: number
    pageSize?: number
  } = {}): Promise<ExpenseListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10
    const limitStart = (page - 1) * pageSize
    const filters: unknown[] = [...(params.filters ?? [])]
    if (params.status && params.status !== "all") {
      const docstatus = params.status === "submitted" ? 1 : params.status === "cancelled" ? 2 : 0
      filters.push(["Journal Entry", "docstatus", "=", docstatus])
    }
    if (params.search) {
      const term = `%${params.search}%`
      filters.push([
        "OR",
        [["Journal Entry", "name", "like", term]],
        [["Journal Entry", "title", "like", term]],
        [["Journal Entry", "user_remark", "like", term]],
        [["Journal Entry", "remark", "like", term]],
      ])
    }
    const orderBy = params.sortBy
      ? `${params.sortBy} ${params.sortOrder === "asc" ? "asc" : "desc"}`
      : "posting_date desc"

    const [rows, total] = await Promise.all([
      getDocList<Record<string, unknown>>("Journal Entry", {
        fields: LIST_FIELDS,
        filters,
        limitStart,
        limitPageLength: pageSize,
        orderBy,
      }),
      getDocCount("Journal Entry", filters),
    ])
    const expenseAccounts = await fetchExpenseAccounts()
    return {
      items: (rows ?? []).map((r) => decorateExpense(r, expenseAccounts)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getById(name: string): Promise<JournalEntryDoc> {
    return apiClient<JournalEntryDoc>(`/resource/${JOURNAL_ENTRY_DOCTYPE}/${encodeURIComponent(name)}`)
  },

  // frappe.desk.form.save.savedocs ({ doc, action: Save|Update|Submit }).
  async saveDoc(doc: Record<string, unknown>, action: "Save" | "Update" | "Submit"): Promise<JournalEntryDoc> {
    const body = await postMethodRaw<{ message?: string; docs?: JournalEntryDoc[] }>(
      "frappe.desk.form.save.savedocs",
      { doc: JSON.stringify({ ...doc, doctype: JOURNAL_ENTRY_DOCTYPE }), action },
    )
    return body.docs?.[0] as JournalEntryDoc
  },

  async create(data: Record<string, unknown>): Promise<JournalEntryDoc> {
    return this.saveDoc({ ...data, doctype: JOURNAL_ENTRY_DOCTYPE }, "Save")
  },

  async update(doc: Record<string, unknown>): Promise<JournalEntryDoc> {
    return this.saveDoc(doc, "Save")
  },

  async submit(doc: Record<string, unknown>): Promise<JournalEntryDoc> {
    return this.saveDoc(doc, "Submit")
  },

  async submitDoc(name: string): Promise<JournalEntryDoc> {
    return apiClient<JournalEntryDoc>(
      `/resource/${JOURNAL_ENTRY_DOCTYPE}/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ docstatus: 1 }) },
    )
  },

  async cancelDoc(name: string): Promise<void> {
    const body = await postMethodRaw<{ message?: unknown }>("frappe.desk.form.save.cancel", {
      doctype: JOURNAL_ENTRY_DOCTYPE,
      name,
    })
    const messages = serverMessagesFromBody(body)
    if (messages.length > 0) {
      throw new Error(messages[0].message)
    }
  },

  async delete(name: string): Promise<void> {
    return apiClient<void>(`/resource/${JOURNAL_ENTRY_DOCTYPE}/${encodeURIComponent(name)}`, { method: "DELETE" })
  },

  // Amend = client-side clone (amended_from, docstatus 0) re-saved as new.
  async amend(source: JournalEntryDoc | Record<string, unknown>): Promise<JournalEntryDoc> {
    const managedFields = new Set([
      "name", "creation", "modified", "modified_by", "owner",
      "docstatus", "_comments", "_assign", "_liked_by", "_user_tags",
    ])
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(source)) {
      if (managedFields.has(k)) continue
      if (Array.isArray(v)) {
        cleaned[k] = v.map((row: Record<string, unknown>) => {
          if (row && typeof row === "object") {
            const { name: _n, parent: _p, parentfield: _pf, parenttype: _pt, creation: _c, modified: _m, owner: _o, idx: _i, ...rest } = (row as Record<string, unknown>)
            return rest
          }
          return row
        })
      } else {
        cleaned[k] = v
      }
    }
    cleaned.doctype = JOURNAL_ENTRY_DOCTYPE
    cleaned.amended_from = String((source as Record<string, unknown>).name)
    cleaned.docstatus = 0
    return this.saveDoc(cleaned, "Save")
  },

  async bulkSubmit(names: string[]): Promise<{ failed: string[]; enqueued: boolean; messages: AppMessage[] }> {
    const result = await postMethodRaw<{ message?: string[] | null; failed?: string[] } & Record<string, unknown>>(
      "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
      { doctype: JOURNAL_ENTRY_DOCTYPE, action: "submit", docnames: JSON.stringify(names) },
    )
    const msg = Array.isArray(result.message) ? result.message : []
    const messages = serverMessagesFromBody(result)
    const explicit = Array.isArray(result.failed) ? result.failed : msg
    return {
      failed: explicit.length > 0 ? explicit : [],
      enqueued: result.message == null,
      messages,
    }
  },

  async bulkCancel(names: string[]): Promise<{ failed: string[]; enqueued: boolean; messages: AppMessage[] }> {
    const result = await postMethodRaw<{ message?: string[] | null; failed?: string[] } & Record<string, unknown>>(
      "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
      { doctype: JOURNAL_ENTRY_DOCTYPE, action: "cancel", docnames: JSON.stringify(names) },
    )
    const msg = Array.isArray(result.message) ? result.message : []
    const messages = serverMessagesFromBody(result)
    const explicit = Array.isArray(result.failed) ? result.failed : msg
    return {
      failed: explicit.length > 0 ? explicit : [],
      enqueued: result.message == null,
      messages,
    }
  },

  async bulkDelete(names: string[]): Promise<{ failed: string[]; deleted: string[]; messages: AppMessage[] }> {
    const requested = Array.from(new Set((names ?? []).filter(Boolean)))
    if (requested.length === 0) return { failed: [], deleted: [], messages: [] }
    const result = await postMethodRaw<{ message?: { undeleted_items?: string[] } | string[] } & Record<string, unknown>>(
      "frappe.desk.reportview.delete_items",
      { doctype: JOURNAL_ENTRY_DOCTYPE, items: JSON.stringify(requested) },
    )
    const msg = result.message
    const messages = serverMessagesFromBody(result)
    const undeleted = Array.isArray(msg) ? msg : Array.isArray(msg?.undeleted_items) ? msg.undeleted_items : []
    return {
      failed: undeleted,
      deleted: requested.filter((name) => !undeleted.includes(name)),
      messages,
    }
  },

  async exportRecords(options?: {
    fileType?: "CSV" | "Excel"
    recordMode?: "all" | "by_filter" | "5_records" | "blank_template"
    fields?: Record<string, string[]>
    filters?: unknown[]
  }): Promise<Blob> {
    return serverDownloadTemplate({
      doctype: JOURNAL_ENTRY_DOCTYPE,
      fileType: options?.fileType ?? "CSV",
      recordMode: options?.recordMode ?? "by_filter",
      fields: options?.fields && Object.keys(options.fields).length > 0
        ? options.fields
        : {
            "Journal Entry": [
              "name", "title", "voucher_type", "posting_date", "company",
              "remark", "user_remark", "bill_no", "total_debit", "total_credit",
              "docstatus", "status",
            ],
            accounts: [
              "account", "party_type", "party", "debit_in_account_currency",
              "credit_in_account_currency", "cost_center", "project",
            ],
          },
      filters: options?.filters,
    })
  },
}

// ── Defaults from the active company (paid-from / expense account) ─────
export async function getExpenseDefaults(): Promise<{
  company: string
  defaultExpenseAccount: string
  defaultPaidFrom: string
  defaultCostCenter: string
}> {
  const defaults = await getCompanyDefaults()
  const accountNames = await listAccountNames([...ACCOUNT_MASTER_FILTER, ["company", "=", defaults.company]])
  return {
    company: defaults.company,
    defaultExpenseAccount: accountNames[0] ?? "",
    defaultPaidFrom: defaults.defaultBankAccount || defaults.defaultCashAccount || "",
    defaultCostCenter: defaults.defaultCostCenter || "Main - BE",
  }
}