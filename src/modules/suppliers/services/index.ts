import { apiClient, serverDownloadTemplate } from "@/services/api-client"
import { getDocCount, getDocList, validateLink as frappeValidateLink } from "@/services/frappe-client"
import type {
  Supplier, SupplierListResponse, SupplierListFilters, SupplierFormData,
  SupplierDetail, SupplierDashboardCounts, SupplierAddressInput,
  SupplierAccountRow, SupplierContactDetail, SupplierAddressDetail,
} from "../types"
export type {
  Supplier, SupplierListResponse, SupplierListFilters, SupplierFormData,
  SupplierDetail, SupplierDashboardCounts, SupplierAddressInput,
  SupplierAccountRow, SupplierContactDetail, SupplierAddressDetail,
  SupplierStatus, SupplierHoldType,
} from "../types"

export function buildSupplierListUrl(
  doctype: string,
  params: {
    fields: string[]
    filters?: unknown[]
    limit_page_length?: number
    limit_start?: number
    order_by?: string
  }
): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent(doctype)}?${qp.toString()}`
}

async function fetchLinkOptions(doctype: string, orderByField = "name", filters?: unknown[]): Promise<string[]> {
  try {
    const rows = await apiClient<Array<{ name: string }>>(
      buildSupplierListUrl(doctype, {
        fields: ["name"],
        order_by: `${orderByField} asc`,
        limit_page_length: 0,
        filters,
      })
    )
    return rows.map((r) => r.name)
  } catch {
    return []
  }
}

export async function fetchFieldOptions(doctype: string, fieldname: string): Promise<string[]> {
  try {
    const doc = await apiClient<{ fields: Array<{ fieldname: string; options?: string }> }>(
      `/resource/DocType/${encodeURIComponent(doctype)}?fields=["fields.fieldname","fields.options"]`
    )
    const field = doc.fields?.find((f) => f.fieldname === fieldname)
    if (!field?.options) return []
    return field.options.split("\n").filter(Boolean)
  } catch {
    return []
  }
}

const searchLinkInFlight = new Map<string, Promise<{ value: string; label: string; description: string }[]>>()

export async function searchLink(doctype: string, query: string, referenceDoctype?: string, filters?: unknown[][] | Record<string, string | number | boolean | unknown[]>, customQuery?: string, ignoreUserPermissions?: boolean): Promise<{ value: string; label: string; description: string }[]> {
  const qp = new URLSearchParams()
  qp.set("doctype", doctype)
  qp.set("txt", query)
  if (referenceDoctype) qp.set("reference_doctype", referenceDoctype)
  qp.set("ignore_user_permissions", ignoreUserPermissions ? "1" : "0")
  if (filters) qp.set("filters", JSON.stringify(filters))
  if (customQuery) qp.set("query", customQuery)
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

export async function validateLink(doctype: string, docname: string): Promise<void> {
  await frappeValidateLink(doctype, docname)
}

export const supplierLookups = {
  supplierGroups: () => fetchLinkOptions("Supplier Group", "name", [["is_group", "=", 0]]),
  supplierTypes: async () => {
    const fromDoctype = await fetchFieldOptions("Supplier", "supplier_type")
    if (fromDoctype.length > 0) return fromDoctype
    return ["Company", "Individual"]
  },
  territories: () => fetchLinkOptions("Territory", "name", [["is_group", "=", 0]]),
  countries: () => fetchLinkOptions("Country"),
  companies: () => fetchLinkOptions("Company"),
  currencies: () => fetchLinkOptions("Currency"),
  payableAccounts: () => fetchLinkOptions("Account", "name", [["account_type", "=", "Payable"], ["root_type", "=", "Liability"], ["is_group", "=", 0]]),
  advanceAccounts: () => fetchLinkOptions("Account", "name", [["account_type", "=", "Payable"], ["root_type", "=", "Liability"], ["is_group", "=", 0]]),
  paymentTermsTemplates: () => fetchLinkOptions("Payment Terms Template"),
  taxWithholdingCategories: () => fetchLinkOptions("Tax Withholding Category"),
}

interface SupplierRow extends Omit<Supplier, "status"> { }

const SUPPLIER_FIELDS: (keyof SupplierRow)[] = [
  "name", "supplier_name", "supplier_group", "supplier_type", "territory",
  "country", "company", "currency", "is_group", "is_internal_supplier",
  "supplier_primary_address", "supplier_primary_contact", "supplier_details",
  "website", "language", "email_id", "mobile_no", "first_name", "last_name",
  "tax_id", "tax_category", "tax_withholding_category", "payment_terms",
  "advance_account", "on_hold", "on_hold_until", "hold_type", "disabled",
  "creation", "modified",
]

export const SUPPLIER_EXPORT_FIELDS: Record<string, string[]> = {
  Supplier: [
    "name", "supplier_name", "supplier_group", "supplier_type", "territory",
    "country", "company", "currency", "website", "language",
    "email_id", "mobile_no", "tax_id", "tax_category",
    "tax_withholding_category", "payment_terms", "advance_account",
    "is_group", "is_internal_supplier", "on_hold", "on_hold_until", "hold_type",
    "disabled", "creation", "modified",
  ],
  default_payable_accounts: ["company", "account"],
}

function toSupplierStatus(row: SupplierRow): Supplier["status"] {
  if (row.on_hold) return "on_hold"
  if (row.disabled) return "disabled"
  return "active"
}

function toSupplier(row: SupplierRow): Supplier {
  return {
    ...row,
    on_hold: row.on_hold ?? 0,
    disabled: row.disabled ?? 0,
    is_group: row.is_group ?? 0,
    status: toSupplierStatus(row),
  }
}

async function getOutstandingBySupplier(supplierNames: string[]): Promise<Map<string, number>> {
  if (supplierNames.length === 0) return new Map()
  const rows = await apiClient<Array<{ supplier: string; outstanding_amount: number }>>(
    buildSupplierListUrl("Purchase Invoice", {
      fields: ["supplier", "outstanding_amount"],
      filters: [
        ["docstatus", "=", 1],
        ["supplier", "in", supplierNames],
      ],
    })
  )
  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(row.supplier, (map.get(row.supplier) ?? 0) + row.outstanding_amount)
  }
  return map
}

// Purchase Invoice fixtures may be absent in a given environment (tests, early
// bench), so outstanding never hard-fails the supplier list.
async function outstandingBySupplierSafe(supplierNames: string[]): Promise<Map<string, number>> {
  try {
    return await getOutstandingBySupplier(supplierNames)
  } catch {
    return new Map<string, number>()
  }
}

function toSupplierDocPayload(data: SupplierFormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    supplier_name: data.supplier_name.trim(),
    supplier_group: data.supplier_group,
    supplier_type: data.supplier_type,
    is_group: data.is_group ? 1 : 0,
    on_hold: data.on_hold ? 1 : 0,
    disabled: data.disabled ? 1 : 0,
  }
  if (data.naming_series) payload.naming_series = data.naming_series
  if (data.territory) payload.territory = data.territory
  if (data.country) payload.country = data.country
  if (data.currency) payload.currency = data.currency
  if (data.tax_withholding_category) payload.tax_withholding_category = data.tax_withholding_category
  if (data.payment_terms) payload.payment_terms = data.payment_terms
  if (data.advance_account) payload.advance_account = data.advance_account
  if (data.tax_id) payload.tax_id = data.tax_id
  if (data.tax_category) payload.tax_category = data.tax_category
  if (data.website) payload.website = data.website
  if (data.email_id) payload.email_id = data.email_id
  if (data.on_hold_until) payload.on_hold_until = data.on_hold_until
  if (data.hold_type) payload.hold_type = data.hold_type
  payload.default_payable_accounts = (data.default_payable_accounts ?? []).map(
    (row): SupplierAccountRow => ({ company: row.company, account: row.account })
  )
  return payload
}

interface ContactDoc {
  name: string
  first_name: string
  email_ids?: Array<{ email_id: string; is_primary: 0 | 1 }>
  phone_nos?: Array<{ phone: string; is_primary_mobile_no: 0 | 1 }>
}

async function createContact(
  supplierName: string,
  firstName?: string,
  lastName?: string,
  email?: string,
  phone?: string
): Promise<ContactDoc> {
  return apiClient<ContactDoc>("/resource/Contact", {
    method: "POST",
    body: JSON.stringify({
      first_name: firstName || supplierName,
      ...(lastName ? { last_name: lastName } : {}),
      email_ids: email ? [{ email_id: email, is_primary: 1 }] : [],
      phone_nos: phone ? [{ phone, is_primary_mobile_no: 1 }] : [],
      links: [{ link_doctype: "Supplier", link_name: supplierName }],
    }),
  })
}

async function updateContact(
  contactName: string,
  email?: string,
  phone?: string
): Promise<ContactDoc> {
  return apiClient<ContactDoc>(`/resource/Contact/${encodeURIComponent(contactName)}`, {
    method: "PUT",
    body: JSON.stringify({
      email_ids: email ? [{ email_id: email, is_primary: 1 }] : [],
      phone_nos: phone ? [{ phone, is_primary_mobile_no: 1 }] : [],
    }),
  })
}

async function createAddress(
  supplierName: string,
  type: string,
  input: SupplierAddressInput
): Promise<SupplierAddressDetail> {
  return apiClient<SupplierAddressDetail>("/resource/Address", {
    method: "POST",
    body: JSON.stringify({
      address_type: type,
      address_line1: input.address_line1,
      ...(input.address_line2 ? { address_line2: input.address_line2 } : {}),
      city: input.city,
      ...(input.state ? { state: input.state } : {}),
      country: input.country,
      ...(input.pincode ? { pincode: input.pincode } : {}),
      is_primary_address: 1,
      links: [{ link_doctype: "Supplier", link_name: supplierName }],
    }),
  })
}

async function updateAddress(
  addressName: string,
  input: SupplierAddressInput
): Promise<SupplierAddressDetail> {
  return apiClient<SupplierAddressDetail>(`/resource/Address/${encodeURIComponent(addressName)}`, {
    method: "PUT",
    body: JSON.stringify({
      address_type: input.address_type,
      address_line1: input.address_line1,
      ...(input.address_line2 ? { address_line2: input.address_line2 } : {}),
      city: input.city,
      ...(input.state ? { state: input.state } : {}),
      country: input.country,
      ...(input.pincode ? { pincode: input.pincode } : {}),
    }),
  })
}

const supplierDetailInFlight = new Map<string, Promise<SupplierDetail>>()

export interface SupplierTransaction {
  doctype: "Purchase Order" | "Purchase Invoice" | "Payment Entry"
  name: string
  date: string
  amount: number
  status: string
  docstatus: number
}

export const supplierService = {
  lookups: supplierLookups,
  fetchFieldOptions,
  searchLink,
  validateLink,

  async list(params: SupplierListFilters = {}): Promise<SupplierListResponse> {
    const pageSize = params.pageLength ?? params.pageSize ?? 20
    const limit_start = params.start != null ? params.start : ((params.page ?? 1) - 1) * pageSize
    const searchFilters = params.search
      ? [["Supplier", "supplier_name", "like", `%${params.search}%`]]
      : []
    const statusFilters: unknown[][] = []
    if (params.status === "on_hold") statusFilters.push(["Supplier", "on_hold", "=", 1])
    if (params.status === "disabled") statusFilters.push(["Supplier", "disabled", "=", 1])
    const extraFilters = params.filters ?? []
    const filters = [...searchFilters, ...statusFilters, ...extraFilters]
    const queryFilters = filters.length > 0 ? filters : undefined
    const order_by = params.sortBy
      ? `${params.sortBy} ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
      : "supplier_name ASC"

    const [rows, total, outstandingMap] = await Promise.all([
      apiClient<SupplierRow[]>(
        buildSupplierListUrl("Supplier", {
          fields: SUPPLIER_FIELDS as string[],
          filters: queryFilters,
          limit_start,
          limit_page_length: pageSize,
          order_by,
        })
      ),
      getDocCount("Supplier", queryFilters),
      getOutstandingBySupplier([]),
    ])

    const names = rows.map((r) => r.name)
    const outstanding = names.length > 0
      ? await outstandingBySupplierSafe(names)
      : outstandingMap

    const items = rows.map((row) => ({
      ...toSupplier(row),
      outstanding: outstanding.get(row.name) ?? 0,
    }))

    return {
      items,
      total,
      page: params.page ?? 1,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getById(name: string): Promise<SupplierDetail> {
    const inflight = supplierDetailInFlight.get(name)
    if (inflight) return inflight
    const promise = (async () => {
      const [row, addressRows, contactRows] = await Promise.all([
        apiClient<SupplierRow>(`/resource/Supplier/${encodeURIComponent(name)}`),
        apiClient<SupplierAddressDetail[]>(
          buildSupplierListUrl("Address", {
            fields: ["name", "address_type", "address_line1", "address_line2", "city", "state", "country", "pincode", "is_primary_address"],
            filters: [
              ["Dynamic Link", "link_doctype", "=", "Supplier"],
              ["Dynamic Link", "link_name", "=", name],
            ],
          })
        ).catch(() => [] as SupplierAddressDetail[]),
        apiClient<Array<SupplierContactDetail & { email_ids?: Array<{ email_id: string; is_primary: 0 | 1 }>; phone_nos?: Array<{ phone: string; is_primary_mobile_no: 0 | 1 }> }>>(
          buildSupplierListUrl("Contact", {
            fields: ["name", "first_name", "last_name", "is_primary_contact"],
            filters: [
              ["Dynamic Link", "link_doctype", "=", "Supplier"],
              ["Dynamic Link", "link_name", "=", name],
            ],
          })
        ).catch(() => []),
      ])

      const contacts: SupplierContactDetail[] = contactRows.map((c) => ({
        name: c.name,
        first_name: c.first_name ?? c.name,
        last_name: c.last_name,
        is_primary_contact: c.is_primary_contact ?? 0,
      }))

      const outstandingMap = await outstandingBySupplierSafe([name])
      const base: Supplier = {
        ...toSupplier(row),
        outstanding: outstandingMap.get(name) ?? 0,
      }

      return {
        ...base,
        addresses: addressRows,
        contacts,
      }
    })().finally(() => {
      supplierDetailInFlight.delete(name)
    })
    supplierDetailInFlight.set(name, promise)
    return promise
  },

  async create(data: SupplierFormData): Promise<Supplier> {
    const supplierRow = await apiClient<SupplierRow>("/resource/Supplier", {
      method: "POST",
      body: JSON.stringify(toSupplierDocPayload(data)),
    })

    const patch: Record<string, unknown> = {}

    if (data.contactEmail || data.contactPhone) {
      const contact = await createContact(
        supplierRow.name,
        data.contactFirstName || data.supplier_name,
        data.contactLastName,
        data.contactEmail,
        data.contactPhone
      )
      patch.supplier_primary_contact = contact.name
    }

    if (data.primaryAddress) {
      const addr = await createAddress(supplierRow.name, "Billing", data.primaryAddress)
      patch.supplier_primary_address = addr.name
    }

    let finalRow = supplierRow
    if (Object.keys(patch).length > 0) {
      finalRow = await apiClient<SupplierRow>(
        `/resource/Supplier/${encodeURIComponent(supplierRow.name)}`,
        { method: "PUT", body: JSON.stringify(patch) }
      )
    }

    return toSupplier(finalRow)
  },

  async update(name: string, data: SupplierFormData): Promise<Supplier> {
    const updatedRow = await apiClient<SupplierRow>(
      `/resource/Supplier/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify(toSupplierDocPayload(data)) }
    )

    if (data.contactEmail || data.contactPhone) {
      if (data.existingContactName) {
        await updateContact(data.existingContactName, data.contactEmail, data.contactPhone)
      } else {
        const contact = await createContact(name, data.contactFirstName || data.supplier_name, data.contactLastName, data.contactEmail, data.contactPhone)
        await apiClient(`/resource/Supplier/${encodeURIComponent(name)}`, {
          method: "PUT",
          body: JSON.stringify({ supplier_primary_contact: contact.name }),
        })
      }
    }

    if (data.primaryAddress) {
      if (data.existingPrimaryAddressName) {
        await updateAddress(data.existingPrimaryAddressName, data.primaryAddress)
      } else {
        const addr = await createAddress(name, "Billing", data.primaryAddress)
        await apiClient(`/resource/Supplier/${encodeURIComponent(name)}`, {
          method: "PUT",
          body: JSON.stringify({ supplier_primary_address: addr.name }),
        })
      }
    }

    const outstandingMap = await outstandingBySupplierSafe([name])
    return {
      ...toSupplier(updatedRow),
      outstanding: outstandingMap.get(name) ?? 0,
    }
  },

  async delete(name: string): Promise<void> {
    await apiClient<void>("/method/frappe.desk.reportview.delete_items", {
      method: "POST",
      body: JSON.stringify({ items: JSON.stringify([name]), doctype: "Supplier" }),
    })
  },

  async getDashboardCounts(name: string): Promise<SupplierDashboardCounts> {
    const [purchaseOrders, purchaseInvoices, paymentEntries, submittedPis] = await Promise.all([
      getDocCount("Purchase Order", [["supplier", "=", name]]),
      getDocCount("Purchase Invoice", [["supplier", "=", name]]),
      getDocCount("Payment Entry", [["party_type", "=", "Supplier"], ["party", "=", name]]),
      getDocList<{ outstanding_amount: number }>("Purchase Invoice", {
        fields: ["outstanding_amount"],
        filters: [["docstatus", "=", 1], ["supplier", "=", name]],
      }).catch(() => []),
    ])

    const outstanding = submittedPis.reduce((sum, r) => sum + (Number(r.outstanding_amount) || 0), 0)

    return {
      purchase_orders: purchaseOrders,
      purchase_invoices: purchaseInvoices,
      payment_entries: paymentEntries,
      outstanding,
    }
  },

  async getTransactions(name: string, limit = 5): Promise<SupplierTransaction[]> {
    const [pos, pis, pes] = await Promise.all([
      getDocList<Record<string, unknown>>("Purchase Order", {
        fields: ["name", "transaction_date", "grand_total", "status", "docstatus"],
        filters: [["supplier", "=", name]],
        orderBy: "transaction_date desc",
        limitPageLength: limit,
      }).catch(() => []),
      getDocList<Record<string, unknown>>("Purchase Invoice", {
        fields: ["name", "posting_date", "grand_total", "outstanding_amount", "status", "docstatus"],
        filters: [["supplier", "=", name]],
        orderBy: "posting_date desc",
        limitPageLength: limit,
      }).catch(() => []),
      getDocList<Record<string, unknown>>("Payment Entry", {
        fields: ["name", "posting_date", "paid_amount", "status", "docstatus"],
        filters: [["party_type", "=", "Supplier"], ["party", "=", name]],
        orderBy: "posting_date desc",
        limitPageLength: limit,
      }).catch(() => []),
    ])

    const map: SupplierTransaction[] = [
      ...pos.map((r, i): SupplierTransaction => ({
        doctype: "Purchase Order",
        name: String(r.name ?? ""),
        date: String(r.transaction_date ?? ""),
        amount: Number(r.grand_total ?? 0),
        status: String(r.status ?? "Draft"),
        docstatus: Number(r.docstatus ?? 0),
        _idx: i,
      }) as SupplierTransaction & { _idx: number }),
      ...pis.map((r, i): SupplierTransaction => ({
        doctype: "Purchase Invoice",
        name: String(r.name ?? ""),
        date: String(r.posting_date ?? ""),
        amount: Number(r.grand_total ?? 0),
        status: String(r.status ?? "Draft"),
        docstatus: Number(r.docstatus ?? 0),
        _idx: i,
      }) as SupplierTransaction & { _idx: number }),
      ...pes.map((r, i): SupplierTransaction => ({
        doctype: "Payment Entry",
        name: String(r.name ?? ""),
        date: String(r.posting_date ?? ""),
        amount: Number(r.paid_amount ?? 0),
        status: Number(r.docstatus ?? 0) === 1 ? "Submitted" : Number(r.docstatus ?? 0) === 2 ? "Cancelled" : "Draft",
        docstatus: Number(r.docstatus ?? 0),
        _idx: i,
      }) as SupplierTransaction & { _idx: number }),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit)
      .map(({ _idx, ...rest }: SupplierTransaction & { _idx?: number }) => rest)

    return map
  },

  async exportRecords(options?: {
    fileType?: "CSV" | "Excel"
    recordMode?: "all" | "by_filter" | "5_records" | "blank_template"
    fields?: Record<string, string[]>
    filters?: unknown[]
  }): Promise<Blob> {
    return serverDownloadTemplate({
      doctype: "Supplier",
      fileType: options?.fileType ?? "CSV",
      recordMode: options?.recordMode ?? "by_filter",
      fields: options?.fields && Object.keys(options.fields).length > 0
        ? options.fields
        : SUPPLIER_EXPORT_FIELDS,
      filters: options?.filters,
    })
  },
}