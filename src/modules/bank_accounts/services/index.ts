import { apiClient, serverDownloadTemplate } from "@/services/api-client"
import { postMethod, getDocCount } from "@/services/frappe-client"
import type {
  BankAccount,
  BankAccountListFilters,
  BankAccountListResponse,
  BankAccountFormData,
} from "../types"

export type {
  BankAccount,
  BankAccountListFilters,
  BankAccountListResponse,
  BankAccountFormData,
} from "../types"

export const BANK_ACCOUNT_LIST_FIELDS = [
  "name",
  "account_name",
  "account",
  "bank",
  "account_type",
  "account_subtype",
  "company",
  "is_default",
  "is_company_account",
  "party_type",
  "party",
  "iban",
  "bank_account_no",
  "branch_code",
  "disabled",
  "last_integration_date",
  "creation",
  "modified",
]

export const BANK_ACCOUNT_EXPORT_FIELDS: Record<string, string[]> = {
  "Bank Account": [
    "account_name",
    "bank",
    "account",
    "account_type",
    "account_subtype",
    "company",
    "is_default",
    "is_company_account",
    "bank_account_no",
    "iban",
    "branch_code",
    "party_type",
    "party",
    "disabled",
  ],
}

export function buildBankAccountListUrl(params: {
  fields: string[]
  filters?: unknown[]
  limit_page_length?: number
  limit_start?: number
  order_by?: string
}): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent("Bank Account")}?${qp.toString()}`
}

const searchLinkInFlight = new Map<string, Promise<{ value: string; label: string; description: string }[]>>()

export async function searchLink(
  doctype: string,
  query: string,
  referenceDoctype?: string,
  filters?: unknown[][] | Record<string, string | number | boolean | unknown[]>,
): Promise<{ value: string; label: string; description: string }[]> {
  const qp = new URLSearchParams()
  qp.set("doctype", doctype)
  qp.set("txt", query)
  if (referenceDoctype) qp.set("reference_doctype", referenceDoctype)
  qp.set("ignore_user_permissions", "0")
  if (filters) qp.set("filters", JSON.stringify(filters))
  qp.set("page_length", "10")
  const url = `/method/frappe.desk.search.search_link?${qp.toString()}`
  const inflight = searchLinkInFlight.get(url)
  if (inflight) return inflight
  const promise = apiClient<{ value: string; label: string; description: string }[]>(url).catch(() => [])
  searchLinkInFlight.set(url, promise)
  promise.finally(() => {
    searchLinkInFlight.delete(url)
  })
  return promise
}

async function fetchLinkOptions(filters?: unknown[]): Promise<string[]> {
  try {
    const rows = await apiClient<Array<{ name: string }>>(
      buildBankAccountListUrl({
        fields: ["name"],
        order_by: "name asc",
        limit_page_length: 0,
        filters,
      })
    )
    return rows.map((r) => r.name)
  } catch {
    return []
  }
}

export const bankAccountLookups = {
  banks: () => searchLink("Bank", "", undefined, []),
  accounts: (company?: string) =>
    fetchLinkOptions([
      ["account_type", "=", "Bank"],
      ["is_group", "=", 0],
      ...(company ? [["company", "=", company]] : []),
    ]),
  partyTypes: async () => {
    try {
      const rows = await apiClient<Array<{ name: string }>>(
        `/resource/Party%20Type?fields=${encodeURIComponent(JSON.stringify(["name"]))}&limit_page_length=0`
      )
      return rows.map((r) => r.name)
    } catch {
      return ["Customer", "Supplier"]
    }
  },
}

function toFormDoc(data: BankAccountFormData): Record<string, unknown> {
  return {
    account_name: data.account_name,
    bank: data.bank,
    is_company_account: data.is_company_account ? 1 : 0,
    is_default: data.is_default ? 1 : 0,
    disabled: data.disabled ? 1 : 0,
    company: data.company || undefined,
    account: data.account || undefined,
    account_type: data.account_type || undefined,
    account_subtype: data.account_subtype || undefined,
    party_type: data.party_type || undefined,
    party: data.party || undefined,
    iban: data.iban || undefined,
    bank_account_no: data.bank_account_no || undefined,
    branch_code: data.branch_code || undefined,
    last_integration_date: data.last_integration_date || undefined,
  }
}

export const bankAccountService = {
  searchLink,

  async partyTypes(): Promise<string[]> {
    try {
      const rows = await apiClient<Array<{ name: string }>>(
        `/resource/Party%20Type?fields=${encodeURIComponent(JSON.stringify(["name"]))}&limit_page_length=0`
      )
      const names = rows.map((r) => r.name)
      return names.length > 0 ? names : ["Customer", "Supplier", "Employee"]
    } catch {
      return ["Customer", "Supplier", "Employee"]
    }
  },
  validateLink: async (doctype: string, docname: string): Promise<void> => {
    await postMethod("frappe.client.validate_link", {
      doctype,
      docname,
      fields: [],
    })
  },

  async list(params: BankAccountListFilters = {}): Promise<BankAccountListResponse> {
    const pageSize = params.pageLength ?? params.pageSize ?? 20
    const limit_start = params.start != null ? params.start : ((params.page ?? 1) - 1) * pageSize
    const searchFilters = params.search
      ? [
          ["account_name", "like", `%${params.search}%`],
          ["account", "like", `%${params.search}%`],
        ]
      : []
    const statusFilters: unknown[][] = []
    if (params.status === "enabled") statusFilters.push(["disabled", "=", 0])
    if (params.status === "disabled") statusFilters.push(["disabled", "=", 1])
    const filters = [...searchFilters, ...statusFilters, ...(params.filters ?? [])]
    const queryFilters = filters.length > 0 ? filters : undefined
    const order_by = params.sortBy
      ? `${params.sortBy} ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
      : "account_name ASC"

    const [rows, total] = await Promise.all([
      apiClient<BankAccount[]>(
        buildBankAccountListUrl({
          fields: BANK_ACCOUNT_LIST_FIELDS,
          filters: queryFilters,
          limit_start,
          limit_page_length: pageSize,
          order_by,
        })
      ),
      getDocCount("Bank Account", queryFilters),
    ])

    return {
      items: rows,
      total,
      page: params.page ?? 1,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getById(name: string): Promise<BankAccount> {
    return apiClient<BankAccount>(`/resource/Bank%20Account/${encodeURIComponent(name)}`)
  },

  async create(data: BankAccountFormData): Promise<BankAccount> {
    return apiClient<BankAccount>("/resource/Bank%20Account", {
      method: "POST",
      body: JSON.stringify(toFormDoc(data)),
    })
  },

  async update(name: string, data: Partial<BankAccountFormData>): Promise<BankAccount> {
    return apiClient<BankAccount>(`/resource/Bank%20Account/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify(toFormDoc(data as BankAccountFormData)),
    })
  },

  async delete(name: string): Promise<void> {
    await apiClient(`/resource/Bank%20Account/${encodeURIComponent(name)}`, { method: "DELETE" })
  },

  async getBankAccountDetails(bankAccount: string): Promise<{
    account?: string
    bank?: string
    bank_account_no?: string
  }> {
    return postMethod("erpnext.accounts.doctype.bank_account.bank_account.get_bank_account_details", {
      bank_account: bankAccount,
    })
  },

  async makeBankAccount(doctype: string, docname: string): Promise<{ name: string }> {
    return postMethod<{ name: string }>(
      "erpnext.accounts.doctype.bank_account.bank_account.make_bank_account",
      { doctype, docname }
    )
  },

  async exportRecords(options?: {
    fileType?: "CSV" | "Excel"
    recordMode?: "all" | "by_filter" | "5_records" | "blank_template"
    fields?: Record<string, string[]>
    filters?: unknown[]
  }): Promise<Blob> {
    return serverDownloadTemplate({
      doctype: "Bank Account",
      fileType: options?.fileType ?? "CSV",
      recordMode: options?.recordMode ?? "by_filter",
      fields: options?.fields && Object.keys(options.fields).length > 0
        ? options.fields
        : BANK_ACCOUNT_EXPORT_FIELDS,
      filters: options?.filters,
    })
  },
}