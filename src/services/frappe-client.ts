import { apiClient, apiClientWithBody } from "./api-client"

interface CacheEntry {
  expires: number
  value: unknown
}

const cache = new Map<string, CacheEntry>()

export function resetDedupCache(): void {
  cache.clear()
}

export function withDedup<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expires > now) return hit.value as Promise<T>

  const promise = fn().catch((err) => {
    cache.delete(key)
    throw err
  })
  cache.set(key, { expires: now + ttlMs, value: promise })
  return promise
}

// POSTs to /api/method/<endpoint> using ERPNext's frappe.call wire format:
// application/x-www-form-urlencoded, object values JSON-stringified.
export function postMethod<T>(
  endpoint: string,
  params: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<T> {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value))
  }
  return apiClient<T>(`/method/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      ...headers,
    },
    body: body.toString(),
  })
}

// Same wire format as postMethod but preserves the full response body, so
// callers can read nested keys like `docs[0]` (used by run_doc_method, which
// stores the mutated document at frappe.response["docs"][0]).
export function postMethodRaw<T>(
  endpoint: string,
  params: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<T> {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value))
  }
  return apiClientWithBody<T>(`/method/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      ...headers,
    },
    body: body.toString(),
  })
}

export interface LinkValidationResult {
  name: string
  [key: string]: unknown
}

export interface AccountingDimension {
  fieldname: string
  document_type: string
  label?: string
}

export interface AccountingDimensionsResult {
  dimensions: AccountingDimension[]
  default_dimensions?: Record<string, string>
}

export interface CompanyFetchFields {
  book_advance_payments_in_separate_party_account: boolean
  reconcile_on_advance_payment_date: boolean
  default_letter_head?: string
}

export function validateLink(
  doctype: string,
  docname: string,
  fields?: string[],
  options?: { dedupeKey?: string }
): Promise<LinkValidationResult> {
  const baseKey = `validate_link:${doctype}:${docname}:${JSON.stringify(fields ?? [])}`
  const key = options?.dedupeKey ? `${baseKey}:${options.dedupeKey}` : baseKey
  return withDedup(key, 2000, () =>
    postMethod<LinkValidationResult>("frappe.client.validate_link", {
      doctype,
      docname,
      fields: fields ?? [],
    }, {
      "x-frappe-doctype": encodeURIComponent(doctype),
    })
  )
}

export function getValue(
  doctype: string,
  fieldname: string | string[],
  filters: string | Record<string, unknown>
): Promise<Record<string, unknown>> {
  const fieldnameParam = Array.isArray(fieldname) ? JSON.stringify(fieldname) : fieldname
  const filtersParam = typeof filters === "string" ? filters : JSON.stringify(filters)

  const key = `get_value:${doctype}:${fieldnameParam}:${filtersParam}`
  return withDedup(key, 2000, () =>
    postMethod<Record<string, unknown>>("frappe.client.get_value", {
      doctype,
      fieldname: fieldnameParam,
      filters: filtersParam,
    })
  )
}

export function getAccountingDimensions(
  withCostCenterAndProject = true
): Promise<AccountingDimensionsResult> {
  const key = `get_dimensions:${withCostCenterAndProject}`
  return withDedup(key, 2000, () =>
    apiClient<Array<unknown>>("/method/erpnext.accounts.doctype.accounting_dimension.accounting_dimension.get_dimensions", {
      method: "POST",
      body: JSON.stringify({ with_cost_center_and_project: withCostCenterAndProject }),
    }).then((result) => {
      const rows = Array.isArray(result) ? result : []

      const dimensionsList = rows[0] && Array.isArray(rows[0]) ? (rows[0] as unknown[]) : []

      const dimensions: AccountingDimension[] = dimensionsList.filter(
        (item): item is AccountingDimension =>
          !!item &&
          typeof (item as AccountingDimension).fieldname === "string" &&
          typeof (item as AccountingDimension).document_type === "string"
      )

      const defaults = rows[1] && typeof rows[1] === "object" ? (rows[1] as unknown as Record<string, string>) : {}

      return { dimensions, default_dimensions: defaults }
    })
  )
}

// ── Shared ERPNext REST helpers (M3) ────────────────────────────────
// Raw wire formats mirror ERPNext's /api/resource/<doctype> + the existing
// module services (invoices, inventory, payments) so all M3 modules share
// one implementation.

export interface DocListParams {
  fields?: string[]
  filters?: unknown[]
  orFilters?: unknown[]
  limitStart?: number
  limitPageLength?: number
  orderBy?: string
  groupBy?: string
}

export function buildDocListUrl(doctype: string, params: DocListParams = {}): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields ?? []))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  if (params.orFilters) qp.set("or_filters", JSON.stringify(params.orFilters))
  qp.set("limit_page_length", String(params.limitPageLength ?? 0))
  if (params.limitStart !== undefined) qp.set("limit_start", String(params.limitStart))
  if (params.orderBy) qp.set("order_by", params.orderBy)
  if (params.groupBy) qp.set("group_by", params.groupBy)
  return `/resource/${encodeURIComponent(doctype)}?${qp.toString()}`
}

export function getDocList<T>(doctype: string, params: DocListParams = {}): Promise<T[]> {
  return apiClient<T[]>(buildDocListUrl(doctype, params))
}

export function getDocCount(doctype: string, filters?: unknown[]): Promise<number> {
  const qp = new URLSearchParams()
  qp.set("doctype", doctype)
  if (filters) qp.set("filters", JSON.stringify(filters))
  return apiClient<number | string>(`/method/frappe.client.get_count?${qp.toString()}`).then(Number)
}

export async function submitDoc(doctype: string, name: string): Promise<void> {
  await apiClient("/method/frappe.client.submit", {
    method: "POST",
    body: JSON.stringify({ doctype, docname: name }),
  })
}

export async function cancelDoc(doctype: string, name: string): Promise<void> {
  await apiClient("/method/frappe.client.cancel", {
    method: "POST",
    body: JSON.stringify({ doctype, docname: name }),
  })
}

const MANAGED_FIELDS = new Set([
  "name", "creation", "modified", "modified_by", "owner",
  "docstatus", "idx", "_comments", "_assign", "_liked_by",
])

export async function amendDoc<T>(doctype: string, name: string): Promise<T> {
  // ERPNext amend flow: GET cancelled doc → strip framework fields → POST with amended_from
  const doc = await apiClient<Record<string, unknown>>(
    `/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
  )
  const cleaned: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(doc)) {
    if (MANAGED_FIELDS.has(k)) continue
    if (Array.isArray(v)) {
      cleaned[k] = v.map((row: Record<string, unknown>) => {
        if (row && typeof row === "object") {
          const { name: _n, creation: _c, modified: _m, owner: _o, ...rest } = row as Record<string, unknown>
          return rest
        }
        return row
      })
    } else {
      cleaned[k] = v
    }
  }
  cleaned.amended_from = name
  cleaned.docstatus = 0
  return apiClient<T>(`/resource/${encodeURIComponent(doctype)}`, {
    method: "POST",
    body: JSON.stringify(cleaned),
  })
}
