import {
  journalEntryService,
  listExpenses,
  buildExpenseJE,
  getExpenseDefaults,
} from "@/services/journal-entry.service"
import { validateLink as frappeValidateLink } from "@/services/frappe-client"
import type {
  JournalEntryDoc,
  JournalEntryAccountRow,
  ExpenseFormData as JeExpenseFormData,
  ExpenseRow,
} from "@/services/journal-entry.service"
import type { Expense, ExpenseListResponse, ExpenseListParams, ExpenseFormData } from "../types"
export type { Expense, ExpenseListResponse, ExpenseListParams, ExpenseFormData, ExpenseStatus, ExpenseAccountLine } from "../types"

export const EXPENSE_DOCTYPE = "Journal Entry"

const dnum = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function toExpenseFormData(form: ExpenseFormData): JeExpenseFormData {
  return { ...form, remark: form.remark, userRemark: form.userRemark }
}

function mapRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    postingDate: row.postingDate,
    company: row.company,
    voucherType: row.voucherType,
    expenseAccount: row.expenseAccount,
    amount: row.expenseAmount,
    paidFrom: row.paidFrom,
    supplier: row.party,
    remark: row.userRemark || row.remark,
    docstatus: row.docstatus,
    status: row.status,
    lines: [],
    totalDebit: row.totalDebit,
    totalCredit: row.totalCredit,
    createdAt: row.createdAt,
    modified: row.modified,
  }
}

function mapDoc(doc: JournalEntryDoc): Expense {
  const accounts = (Array.isArray(doc.accounts) ? doc.accounts : []) as JournalEntryAccountRow[]
  const primary = accounts.find((a) => dnum(a.debit_in_account_currency) > 0) ?? accounts[0]
  const creditRow = accounts.find((a) => dnum(a.credit_in_account_currency) > 0) ?? accounts[1]
  return {
    id: doc.name,
    name: doc.name,
    title: doc.title ?? "",
    postingDate: doc.posting_date,
    company: doc.company,
    voucherType: doc.voucher_type,
    expenseAccount: primary ? primary.account : "",
    amount: primary ? dnum(primary.debit_in_account_currency) : 0,
    paidFrom: creditRow ? creditRow.account : "",
    supplier: primary?.party ?? "",
    remark: doc.user_remark || doc.remark || "",
    docstatus: dnum(doc.docstatus),
    status: dnum(doc.docstatus) === 1 ? "submitted" : dnum(doc.docstatus) === 2 ? "cancelled" : "draft",
    lines: accounts.map((a) => ({
      account: a.account,
      partyType: a.party_type ?? "",
      party: a.party ?? "",
      debit: dnum(a.debit_in_account_currency),
      credit: dnum(a.credit_in_account_currency),
      costCenter: a.cost_center ?? "",
      project: a.project ?? "",
    })),
    totalDebit: dnum(doc.total_debit),
    totalCredit: dnum(doc.total_credit),
    createdAt: doc.creation ?? "",
    modified: doc.modified ?? "",
  }
}

export const expenseService = {
  async list(params: ExpenseListParams = {}): Promise<ExpenseListResponse> {
    const result = await listExpenses({
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
      account: params.account,
      company: params.company,
      status: params.status,
      postingDateFrom: params.postingDateFrom,
      postingDateTo: params.postingDateTo,
      filters: params.filters,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    })
    return {
      items: result.items.map(mapRow),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    }
  },

  async getById(name: string): Promise<Expense> {
    const doc = await journalEntryService.getById(name)
    return mapDoc(doc)
  },

  async getDoc(name: string): Promise<JournalEntryDoc> {
    return journalEntryService.getById(name)
  },

  async create(data: ExpenseFormData): Promise<Expense> {
    const doc = await journalEntryService.create(buildExpenseJE(toExpenseFormData(data)))
    return mapDoc(doc)
  },

  async update(name: string, data: ExpenseFormData): Promise<Expense> {
    const existing = await journalEntryService.getById(name)
    const draft = buildExpenseJE(toExpenseFormData(data))
    const merged: Record<string, unknown> = {
      ...existing,
      ...draft,
      name: existing.name,
      doctype: EXPENSE_DOCTYPE,
      title: String(draft.title ?? existing.title ?? ""),
      remark: String(draft.remark ?? ""),
      user_remark: String(draft.user_remark ?? ""),
    }
    const doc = await journalEntryService.update(merged)
    return mapDoc(doc)
  },

  async submitDoc(doc: Record<string, unknown>): Promise<Expense> {
    const saved = await journalEntryService.submit(doc)
    return mapDoc(saved)
  },

  async submit(name: string): Promise<Expense> {
    const doc = await journalEntryService.submitDoc(name)
    return mapDoc(doc)
  },

  async cancel(name: string): Promise<void> {
    return journalEntryService.cancelDoc(name)
  },

  async amend(doc: JournalEntryDoc | Record<string, unknown>): Promise<Expense> {
    const saved = await journalEntryService.amend(doc)
    return mapDoc(saved)
  },

  async delete(name: string): Promise<void> {
    return journalEntryService.delete(name)
  },

  bulkSubmit: (names: string[]) => journalEntryService.bulkSubmit(names),
  bulkCancel: (names: string[]) => journalEntryService.bulkCancel(names),
  bulkDelete: (names: string[]) => journalEntryService.bulkDelete(names),
  exportRecords: (options?: Parameters<typeof journalEntryService.exportRecords>[0]) =>
    journalEntryService.exportRecords(options),

  lookups: journalEntryService.lookups,
  searchLink: (doctype: string, query: string, filters?: unknown[][]) =>
    journalEntryService.searchLink(doctype, query, filters),
  validateLink: (doctype: string, docname: string) => frappeValidateLink(doctype, docname),
  getDefaults: getExpenseDefaults,
}

export { buildExpenseJE }