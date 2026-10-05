import {
  JOURNAL_ENTRY_DOCTYPE,
  journalEntryService as jeService,
  type JournalEntryDoc,
  type JournalEntryAccountRow,
} from "@/services/journal-entry.service"
import { getDocList, getDocCount } from "@/services/frappe-client"
import { apiClient } from "@/services/api-client"
import type {
  JournalEntryRow,
  JournalEntryListResponse,
  JournalEntryFormData,
  JournalEntryAccountFormRow,
  JournalEntryStatus,
} from "../types"
export type {
  JournalEntryRow,
  JournalEntryListResponse,
  JournalEntryFormData,
  JournalEntryStatus,
  JournalEntryDoc,
  JournalEntryAccountRow,
  JournalEntryAccountFormRow,
}

const dnum = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const LIST_FIELDS = [
  "name", "title", "voucher_type", "posting_date",
  "finance_book", "bill_no", "company",
  "total_debit", "total_credit", "difference", "docstatus", "status",
  "accounts", "owner", "creation", "modified",
]

/** ERPNext Journal Entry voucher types (subset used by the composer). */
export const FALLBACK_VOUCHER_TYPES = [
  "Journal Entry",
  "Bank Entry",
  "Cash Entry",
  "Credit Card Entry",
  "Credit Note",
  "Debit Note",
  "Contra Entry",
  "Opening Entry",
  "Depreciation Entry",
  "Exchange Rate Revaluation",
  "Deferred Revenue",
  "Deferred Expense",
]

export function mapDocstatus(docstatus: number): JournalEntryStatus {
  if (dnum(docstatus) === 2) return "cancelled"
  if (dnum(docstatus) === 1) return "submitted"
  return "draft"
}

function mapListRow(doc: Record<string, unknown>): JournalEntryRow {
  return {
    id: String(doc.name),
    number: String(doc.name),
    title: String(doc.title ?? ""),
    posting_date: String(doc.posting_date ?? ""),
    voucher_type: String(doc.voucher_type ?? "Journal Entry"),
    reference: String(doc.bill_no ?? ""),
    company: String(doc.company ?? ""),
    status: mapDocstatus(dnum(doc.docstatus)),
    docstatus: dnum(doc.docstatus),
    total_debit: dnum(doc.total_debit),
    total_credit: dnum(doc.total_credit),
    createdAt: String(doc.creation ?? doc.posting_date ?? ""),
  }
}

interface ListParams {
  search?: string
  status?: JournalEntryStatus
  filters?: unknown[]
  sortBy?: string
  sortOrder?: "asc" | "desc"
  page?: number
  pageSize?: number
}

async function listFetcher(params: ListParams): Promise<{ rows: JournalEntryRow[]; total: number }> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  const limitStart = (page - 1) * pageSize

  const filters: unknown[] = [...(params.filters ?? [])]
  if (params.status) {
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
      [["Journal Entry", "bill_no", "like", term]],
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
  return { rows: (rows ?? []).map(mapListRow), total }
}

// ── Lookup helpers (ERPNext-faithful, no hardcoded enums beyond fallbacks) ──
async function listNames(doctype: string, fields: string[], filters: unknown[], orderBy = "name asc"): Promise<string[]> {
  try {
    const rows = await getDocList<Record<string, unknown>>(doctype, {
      fields,
      filters,
      limitPageLength: 0,
      orderBy,
    })
    return (rows ?? []).map((r) => String(r.name))
  } catch {
    return []
  }
}

const journalEntryLookups = {
  companies: () => listNames("Company", ["name"], []),
  costCenters: (company?: string) =>
    listNames(
      "Account",
      ["name"],
      company ? [["is_group", "=", 0], ["company", "=", company]] : [["is_group", "=", 0]],
    ),
  projects: () => listNames("Project", ["name"], []),
  voucherTypes: async (): Promise<string[]> => {
    const rows = await getDocList<Record<string, unknown>>("Journal Entry", {
      fields: ["voucher_type"],
      limitPageLength: 0,
      orderBy: "name asc",
    }).catch(() => [])
    const seen = new Set((rows ?? []).map((r) => String(r.voucher_type ?? "")).filter(Boolean))
    for (const t of FALLBACK_VOUCHER_TYPES) seen.add(t)
    return Array.from(seen)
  },
  accountOptions: async (company?: string, accountType?: string): Promise<string[]> => {
    const filters: unknown[] = [["is_group", "=", 0]]
    if (company) filters.push(["company", "=", company])
    if (accountType) filters.push(["account_type", "=", accountType])
    return listNames("Account", ["name"], filters)
  },
}

export const journalEntryModuleLookups = journalEntryLookups

function docFromData(data: JournalEntryFormData): Record<string, unknown> {
  const rows = data.accounts ?? []
  const totalDebit = round2(rows.reduce((s, a) => s + dnum(a.debit), 0))
  const totalCredit = round2(rows.reduce((s, a) => s + dnum(a.credit), 0))
  const userRemark = String(data.user_remark ?? data.remark ?? "").trim()
  return {
    ...data,
    doctype: JOURNAL_ENTRY_DOCTYPE,
    title: userRemark || `Journal Entry - ${data.posting_date}`,
    user_remark: userRemark,
    remark: userRemark,
    posting_time: "00:00:00",
    accounts: rows.map(({ key: _k, ...a }) => ({
      doctype: "Journal Entry Account",
      parentfield: "accounts",
      parenttype: "Journal Entry",
      account: a.account,
      party_type: a.party_type,
      party: a.party,
      account_currency: a.account_currency || "CAD",
      exchange_rate: dnum(a.exchange_rate) || 1,
      debit_in_account_currency: dnum(a.debit),
      credit_in_account_currency: dnum(a.credit),
      cost_center: a.cost_center,
      project: a.project,
    })),
    total_debit: totalDebit,
    total_credit: totalCredit,
    difference: round2(totalDebit - totalCredit),
  }
}

export const journalEntryService = {
  lookups: journalEntryLookups,
  searchLink: (doctype: string, txt: string) => jeService.searchLink(doctype, txt),
  getValue: (doctype: string, fieldname: string, args: Record<string, unknown>) =>
    apiClient<Record<string, unknown>>(
      `/method/frappe.client.get_value?${new URLSearchParams({
        doctype,
        fieldname,
        filters: JSON.stringify(args),
      }).toString()}`,
    ),

  async list(params: ListParams = {}): Promise<JournalEntryListResponse> {
    const { rows, total } = await listFetcher(params)
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10
    return { items: rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  },

  async listAll(params: Omit<ListParams, "page" | "pageSize"> = {}): Promise<JournalEntryRow[]> {
    let start = 0
    const pageSize = 200
    const out: JournalEntryRow[] = []
    for (;;) {
      const { rows, total } = await listFetcher({ ...params, page: Math.floor(start / pageSize) + 1, pageSize })
      out.push(...rows)
      if (out.length >= total) break
      start += pageSize
    }
    return out
  },

  async getById(name: string): Promise<JournalEntryDoc> {
    return apiClient<JournalEntryDoc>(
      `/resource/${JOURNAL_ENTRY_DOCTYPE}/${encodeURIComponent(name)}`,
    )
  },

  async create(data: JournalEntryFormData): Promise<JournalEntryDoc> {
    const doc = docFromData(data)
    return jeService.saveDoc(doc, "Save")
  },

  /** Raw doc save used by the form (Save / Submit action parity). */
  async saveAs(doc: Record<string, unknown>, action: "Save" | "Submit" = "Save"): Promise<JournalEntryDoc> {
    return jeService.saveDoc({ ...doc, doctype: JOURNAL_ENTRY_DOCTYPE }, action)
  },

  async update(id: string, data: JournalEntryFormData): Promise<JournalEntryDoc> {
    const existing = await this.getById(id)
    const next = docFromData(data)
    const merged: Record<string, unknown> = {
      ...existing,
      ...next,
      name: id,
      doctype: JOURNAL_ENTRY_DOCTYPE,
      accounts: (next.accounts as Record<string, unknown>[]) ?? existing.accounts,
    }
    return jeService.saveDoc(merged, "Save")
  },

  async submitDoc(name: string): Promise<JournalEntryDoc> {
    return jeService.submitDoc(name)
  },

  async cancelDoc(name: string): Promise<void> {
    return jeService.cancelDoc(name)
  },

  async amend(source: JournalEntryDoc): Promise<JournalEntryDoc> {
    return jeService.amend(source)
  },

  async delete(name: string): Promise<void> {
    return jeService.delete(name)
  },

  async bulkSubmit(names: string[]) {
    return jeService.bulkSubmit(names)
  },

  async bulkCancel(names: string[]) {
    return jeService.bulkCancel(names)
  },

  async bulkDelete(names: string[]) {
    return jeService.bulkDelete(names)
  },

  async exportRecords(options?: {
    fileType?: "CSV" | "Excel"
    fields?: Record<string, string[]>
    filters?: unknown[]
  }): Promise<Blob> {
    return jeService.exportRecords({
      fileType: options?.fileType ?? "CSV",
      recordMode: "by_filter",
      fields: options?.fields,
      filters: options?.filters,
    })
  },
}

export const JOURNAL_ENTRY_EXPORT_FIELDS: Record<string, string[]> = {
  "Journal Entry": [
    "name", "title", "voucher_type", "posting_date", "company",
    "finance_book", "bill_no", "remark", "user_remark",
    "total_debit", "total_credit", "difference", "docstatus", "status",
  ],
  accounts: [
    "account", "party_type", "party", "account_currency", "exchange_rate",
    "debit_in_account_currency", "credit_in_account_currency", "cost_center", "project",
  ],
}