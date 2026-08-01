import { apiClient } from "./api-client"

interface CacheEntry {
  expires: number
  value: unknown
}

const cache = new Map<string, CacheEntry>()

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

export interface LinkValidationResult {
  name: string
  [key: string]: unknown
}

export interface AccountingDimension {
  fieldname: string
  document_type: string
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
