import { apiClient } from "@/services/api-client"
import type {
  Customer, CustomerListResponse, AddressInput, AllowedCompanyRow,
  CreditLimitRow, PartyAccountRow, SalesTeamRow, PortalUserRow,
  SupplierNumberRow, CustomerFormData, CustomerDetail,
} from "../types"
export type {
  Customer, CustomerListResponse, AddressInput, AllowedCompanyRow,
  CreditLimitRow, PartyAccountRow, SalesTeamRow, PortalUserRow,
  SupplierNumberRow, CustomerFormData, CustomerDetail, TransactionCounts,
} from "../types"

export function buildListUrl(
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

async function getCount(doctype: string, filters?: unknown[]): Promise<number> {
  const qp = new URLSearchParams()
  qp.set("doctype", doctype)
  if (filters) qp.set("filters", JSON.stringify(filters))
  const result = await apiClient<number | string>(
    `/method/frappe.client.get_count?${qp.toString()}`
  )
  return Number(result)
}

async function fetchLinkOptions(doctype: string, orderByField = "name", filters?: unknown[]): Promise<string[]> {
  try {
    const rows = await apiClient<Array<{ name: string }>>(
      buildListUrl(doctype, {
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

export const customerLookups = {
  customerGroups: () => fetchLinkOptions("Customer Group", "name", [["is_group", "=", 0]]),
  territories: () => fetchLinkOptions("Territory", "name", [["is_group", "=", 0]]),
  salutations: () => fetchLinkOptions("Salutation"),
  genders: () => fetchLinkOptions("Gender"),
  currencies: () => fetchLinkOptions("Currency"),
  bankAccounts: () => fetchLinkOptions("Bank Account", "name", [["is_company_account", "=", 1]]),
  priceLists: () => fetchLinkOptions("Price List", "name", [["selling", "=", 1]]),
  companies: () => fetchLinkOptions("Company"),
  marketSegments: () => fetchLinkOptions("Market Segment"),
  industries: () => fetchLinkOptions("Industry Type"),
  languages: () => fetchLinkOptions("Language"),
  taxCategories: () => fetchLinkOptions("Tax Category"),
  taxWithholdingGroups: () => fetchLinkOptions("Tax Withholding Group"),
  taxWithholdingCategories: () => fetchLinkOptions("Tax Withholding Category"),
  paymentTermsTemplates: () => fetchLinkOptions("Payment Terms Template"),
  loyaltyPrograms: () => fetchLinkOptions("Loyalty Program"),
  salesPartners: () => fetchLinkOptions("Sales Partner"),
  accounts: () => fetchLinkOptions("Account", "name", [["account_type", "=", "Receivable"], ["root_type", "=", "Asset"], ["is_group", "=", 0]]),
  advanceAccounts: () => fetchLinkOptions("Account", "name", [["account_type", "=", "Receivable"], ["root_type", "=", "Liability"], ["is_group", "=", 0]]),
  salesPersons: () => fetchLinkOptions("Sales Person"),
  users: () => fetchLinkOptions("User", "full_name"),
  leads: () => fetchLinkOptions("Lead", "name"),
  opportunities: () => fetchLinkOptions("Opportunity", "name"),
  prospects: () => fetchLinkOptions("Prospect", "name"),
}

interface CustomerRow extends Omit<Customer, "outstanding" | "status"> { }

const CUSTOMER_FIELDS: (keyof CustomerRow)[] = [
  "name", "customer_name", "customer_type", "customer_group", "territory",
  "gender", "lead_name", "opportunity_name", "prospect_name",
  "is_internal_customer", "represents_company",
  "mobile_no", "email_id", "default_currency", "default_price_list",
  "disabled", "is_frozen", "creation", "modified",
]

function toCustomer(row: CustomerRow, outstanding: number): Customer {
  return {
    ...row,
    outstanding,
    status: row.disabled ? "inactive" : "active",
  }
}

async function fetchOutstandingByCustomer(
  customerNames: string[]
): Promise<Map<string, number>> {
  if (customerNames.length === 0) return new Map()
  const rows = await apiClient<Array<{ customer: string; outstanding_amount: number }>>(
    buildListUrl("Sales Invoice", {
      fields: ["customer", "outstanding_amount"],
      filters: [
        ["docstatus", "=", 1],
        ["customer", "in", customerNames],
      ],
    })
  )
  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(row.customer, (map.get(row.customer) ?? 0) + row.outstanding_amount)
  }
  return map
}

interface ContactDoc {
  name: string
  first_name: string
  email_ids?: Array<{ email_id: string; is_primary: 0 | 1 }>
  phone_nos?: Array<{ phone: string; is_primary_mobile_no: 0 | 1 }>
}

export interface AddressDoc {
  name: string
  address_type: "Billing" | "Shipping" | string
  address_line1: string
  address_line2?: string
  city: string
  state?: string
  country: string
  pincode?: string
  is_primary_address?: 0 | 1
  is_shipping_address?: 0 | 1
}

async function createContact(
  customerName: string,
  displayName: string,
  email?: string,
  phone?: string
): Promise<ContactDoc> {
  return apiClient<ContactDoc>("/resource/Contact", {
    method: "POST",
    body: JSON.stringify({
      first_name: displayName,
      email_ids: email ? [{ email_id: email, is_primary: 1 }] : [],
      phone_nos: phone ? [{ phone, is_primary_mobile_no: 1 }] : [],
      links: [{ link_doctype: "Customer", link_name: customerName }],
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

async function deleteContact(contactName: string): Promise<void> {
  await apiClient<void>(`/resource/Contact/${encodeURIComponent(contactName)}`, {
    method: "DELETE",
  })
}

export async function createAddress(
  customerName: string,
  type: "Billing" | "Shipping",
  input: AddressInput
): Promise<AddressDoc> {
  return apiClient<AddressDoc>("/resource/Address", {
    method: "POST",
    body: JSON.stringify({
      address_title: customerName,
      address_type: type,
      address_line1: input.address_line1,
      address_line2: input.address_line2,
      city: input.city,
      state: input.state,
      country: input.country,
      pincode: input.pincode,
      is_primary_address: type === "Billing" ? 1 : 0,
      is_shipping_address: type === "Shipping" ? 1 : 0,
      links: [{ link_doctype: "Customer", link_name: customerName }],
    }),
  })
}

async function updateAddress(addressName: string, input: AddressInput): Promise<AddressDoc> {
  return apiClient<AddressDoc>(`/resource/Address/${encodeURIComponent(addressName)}`, {
    method: "PUT",
    body: JSON.stringify({
      address_line1: input.address_line1,
      address_line2: input.address_line2,
      city: input.city,
      state: input.state,
      country: input.country,
      pincode: input.pincode,
    }),
  })
}

async function deleteAddress(addressName: string): Promise<void> {
  await apiClient<void>(`/resource/Address/${encodeURIComponent(addressName)}`, {
    method: "DELETE",
  })
}

async function fetchAddressesForCustomer(customerName: string): Promise<AddressDoc[]> {
  return apiClient<AddressDoc[]>(
    buildListUrl("Address", {
      fields: [
        "name", "address_type", "address_line1", "address_line2",
        "city", "state", "country", "pincode",
        "is_primary_address", "is_shipping_address",
      ],
      filters: [
        ["Dynamic Link", "link_doctype", "=", "Customer"],
        ["Dynamic Link", "link_name", "=", customerName],
      ],
    })
  )
}

async function fetchTransactionCounts(customerName: string): Promise<{
  sales_orders: number
  sales_invoices: number
  opportunities: number
  issues: number
}> {
  const [sales_orders, sales_invoices, opportunities, issues] = await Promise.all([
    getCount("Sales Order", [["customer", "=", customerName], ["docstatus", "!=", 2]]),
    getCount("Sales Invoice", [["customer", "=", customerName], ["docstatus", "!=", 2]]),
    getCount("Opportunity", [["party_name", "=", customerName], ["docstatus", "!=", 2]]),
    getCount("Issue", [["customer", "=", customerName]]),
  ])
  return { sales_orders, sales_invoices, opportunities, issues }
}


function toCustomerDocPayload(data: CustomerFormData): Record<string, unknown> {
  return {
    salutation: data.salutation,
    alias: data.alias,
    customer_name: data.customer_name.trim(),
    customer_type: data.customer_type,
    customer_group: data.customer_group,
    territory: data.territory,
    gender: data.gender,
    lead_name: data.lead_name,
    opportunity_name: data.opportunity_name,
    crm_deal: data.crm_deal,
    account_manager: data.account_manager,
    image: data.image,
    default_currency: data.default_currency,
    default_bank_account: data.default_bank_account,
    default_price_list: data.default_price_list,
    is_internal_customer: data.is_internal_customer ? 1 : 0,
    represents_company: data.represents_company,
    market_segment: data.market_segment,
    industry: data.industry,
    customer_pos_id: data.customer_pos_id,
    website: data.website,
    language: data.language,
    customer_details: data.customer_details,
    tax_id: data.tax_id,
    tax_category: data.tax_category,
    tax_withholding_group: data.tax_withholding_group,
    tax_withholding_category: data.tax_withholding_category,
    payment_terms: data.payment_terms,
    loyalty_program: data.loyalty_program,
    default_sales_partner: data.default_sales_partner,
    default_commission_rate: data.default_commission_rate,
    so_required: data.so_required ? 1 : 0,
    dn_required: data.dn_required ? 1 : 0,
    is_frozen: data.is_frozen ? 1 : 0,
    disabled: data.disabled ? 1 : 0,
    ...(data.companies ? { companies: data.companies } : {}),
    ...(data.credit_limits ? { credit_limits: data.credit_limits } : {}),
    ...(data.accounts ? { accounts: data.accounts } : {}),
    ...(data.sales_team ? { sales_team: data.sales_team } : {}),
    ...(data.portal_users ? { portal_users: data.portal_users } : {}),
    ...(data.supplier_numbers ? { supplier_numbers: data.supplier_numbers } : {}),
  }
}

export const customerService = {
  lookups: customerLookups,
  createAddress,

  async list(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<CustomerListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10
    const filters = params.search
      ? [["customer_name", "like", `%${params.search}%`]]
      : undefined

    const [rows, total] = await Promise.all([
      apiClient<CustomerRow[]>(
        buildListUrl("Customer", {
          fields: CUSTOMER_FIELDS as string[],
          filters,
          limit_page_length: pageSize,
          limit_start: (page - 1) * pageSize,
          order_by: "modified desc",
        })
      ),
      getCount("Customer", filters),
    ])

    const outstandingMap = await fetchOutstandingByCustomer(rows.map((r) => r.name))
    const items = rows.map((row) => toCustomer(row, outstandingMap.get(row.name) ?? 0))

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getById(name: string): Promise<CustomerDetail> {
    const [fullDoc, addresses, outstandingMap, transaction_counts] = await Promise.all([
      apiClient<CustomerRow & {
        companies?: AllowedCompanyRow[]
        credit_limits?: CreditLimitRow[]
        accounts?: PartyAccountRow[]
        sales_team?: SalesTeamRow[]
        portal_users?: PortalUserRow[]
        supplier_numbers?: SupplierNumberRow[]
      }>(`/resource/Customer/${encodeURIComponent(name)}`),
      fetchAddressesForCustomer(name),
      fetchOutstandingByCustomer([name]),
      fetchTransactionCounts(name),
    ])
    return {
      ...toCustomer(fullDoc, outstandingMap.get(name) ?? 0),
      transaction_counts,
      addresses: addresses.map((a) => ({
        name: a.name,
        address_type: a.address_type,
        address_line1: a.address_line1,
        address_line2: a.address_line2,
        city: a.city,
        state: a.state,
        country: a.country,
        pincode: a.pincode,
      })),
      companies: fullDoc.companies ?? [],
      credit_limits: fullDoc.credit_limits ?? [],
      accounts: fullDoc.accounts ?? [],
      sales_team: fullDoc.sales_team ?? [],
      portal_users: fullDoc.portal_users ?? [],
      supplier_numbers: fullDoc.supplier_numbers ?? [],
    }
  },

  async create(data: CustomerFormData): Promise<Customer> {
    const customerRow = await apiClient<CustomerRow>("/resource/Customer", {
      method: "POST",
      body: JSON.stringify(toCustomerDocPayload(data)),
    })

    const patch: Record<string, unknown> = {}

    if (data.contactEmail || data.contactPhone) {
      const contact = await createContact(
        customerRow.name,
        data.customer_name,
        data.contactEmail,
        data.contactPhone
      )
      patch.customer_primary_contact = contact.name
    }

    if (data.billingAddress) {
      const addr = await createAddress(customerRow.name, "Billing", data.billingAddress)
      patch.customer_primary_address = addr.name
    }

    if (data.shippingAddress) {
      await createAddress(customerRow.name, "Shipping", data.shippingAddress)
    }

    let finalRow = customerRow
    if (Object.keys(patch).length > 0) {
      finalRow = await apiClient<CustomerRow>(
        `/resource/Customer/${encodeURIComponent(customerRow.name)}`,
        { method: "PUT", body: JSON.stringify(patch) }
      )
    }

    return toCustomer(finalRow, 0)
  },

  async update(name: string, data: CustomerFormData): Promise<Customer> {
    const updatedRow = await apiClient<CustomerRow>(
      `/resource/Customer/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify(toCustomerDocPayload(data)) }
    )

    if (data.contactEmail || data.contactPhone) {
      if (data.existingContactName) {
        await updateContact(data.existingContactName, data.contactEmail, data.contactPhone)
      } else {
        const contact = await createContact(name, data.customer_name, data.contactEmail, data.contactPhone)
        await apiClient(`/resource/Customer/${encodeURIComponent(name)}`, {
          method: "PUT",
          body: JSON.stringify({ customer_primary_contact: contact.name }),
        })
      }
    }

    if (data.billingAddress) {
      if (data.existingBillingAddressName) {
        await updateAddress(data.existingBillingAddressName, data.billingAddress)
      } else {
        const addr = await createAddress(name, "Billing", data.billingAddress)
        await apiClient(`/resource/Customer/${encodeURIComponent(name)}`, {
          method: "PUT",
          body: JSON.stringify({ customer_primary_address: addr.name }),
        })
      }
    }

    if (data.shippingAddress) {
      if (data.existingShippingAddressName) {
        await updateAddress(data.existingShippingAddressName, data.shippingAddress)
      } else {
        await createAddress(name, "Shipping", data.shippingAddress)
      }
    }

    const outstandingMap = await fetchOutstandingByCustomer([name])
    return toCustomer(updatedRow, outstandingMap.get(name) ?? 0)
  },

  async delete(name: string): Promise<void> {
    return apiClient<void>(`/resource/Customer/${encodeURIComponent(name)}`, {
      method: "DELETE",
    })
  },

  async deleteContact(contactName: string): Promise<void> {
    return deleteContact(contactName)
  },

  async deleteAddress(addressName: string): Promise<void> {
    return deleteAddress(addressName)
  },

  async exportToCsv(params?: { search?: string }): Promise<void> {
    const result = await customerService.list({ search: params?.search, page: 1, pageSize: 9999 })
    const headers = ["name", "customer_name", "customer_type", "customer_group", "territory", "email_id", "mobile_no", "outstanding", "status", "creation"]
    const rows = result.items.map((c) =>
      headers.map((h) => {
        const val = String((c as Record<string, unknown>)[h] ?? "")
        return val.includes(",") || val.includes('"') || val.includes("\n")
          ? `"${val.replace(/"/g, '""')}"`
          : val
      }).join(",")
    )
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `customers_export_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  },

  async importFromCsv(file: File): Promise<{ success: number; failed: number; errors: string[] }> {
    const text = await file.text()
    const lines = text.split("\n").filter((l) => l.trim())
    if (lines.length < 2) {
      return { success: 0, failed: 0, errors: ["CSV file is empty or has no data rows"] }
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const nameIdx = headers.indexOf("customer_name")
    const typeIdx = headers.indexOf("customer_type")
    const groupIdx = headers.indexOf("customer_group")
    const territoryIdx = headers.indexOf("territory")
    if (nameIdx === -1) {
      return { success: 0, failed: 0, errors: ["CSV must have a 'customer_name' column"] }
    }
    let success = 0
    let failed = 0
    const errors: string[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim())
      const customerName = cols[nameIdx]
      if (!customerName) continue
      try {
        await customerService.create({
          customer_name: customerName,
          customer_type: (cols[typeIdx] as "Company" | "Individual" | "Partnership") || "Company",
          customer_group: cols[groupIdx] || "",
          territory: cols[territoryIdx] || "",
          so_required: false,
          dn_required: false,
          is_frozen: false,
          disabled: false,
          is_internal_customer: false,
        })
        success++
      } catch (e) {
        failed++
        errors.push(`Row ${i + 1} (${customerName}): ${e instanceof Error ? e.message : "Unknown error"}`)
      }
    }
    return { success, failed, errors }
  },
}

// --- Notes (ERPNext Communication doctype with comment_type="Comment") ---

export interface CustomerNote {
  id: string
  content: string
  author: string
  createdAt: string
}

export const noteService = {
  async list(customerName: string): Promise<CustomerNote[]> {
    try {
      const rows = await apiClient<{
        name: string
        content: string
        owner: string
        creation: string
      }[]>(
        buildListUrl("Communication", {
          fields: ["name", "content", "owner", "creation"],
          filters: [
            ["communication_type", "=", "Comment"],
            ["reference_doctype", "=", "Customer"],
            ["reference_name", "=", customerName],
          ],
          limit_page_length: 100,
          order_by: "creation desc",
        })
      )
      return (rows ?? []).map((r) => ({
        id: r.name,
        content: r.content,
        author: r.owner,
        createdAt: r.creation,
      }))
    } catch {
      return []
    }
  },

  async create(customerName: string, content: string): Promise<CustomerNote> {
    const row = await apiClient<{
      name: string
      content: string
      owner: string
      creation: string
    }>("/resource/Communication", {
      method: "POST",
      body: JSON.stringify({
        communication_type: "Comment",
        comment_type: "Comment",
        reference_doctype: "Customer",
        reference_name: customerName,
        content,
      }),
    })
    return {
      id: row.name,
      content: row.content,
      author: row.owner,
      createdAt: row.creation,
    }
  },

  async delete(noteId: string): Promise<void> {
    await apiClient<void>(`/resource/Communication/${encodeURIComponent(noteId)}`, {
      method: "DELETE",
    })
  },
}