import { apiClient } from "@/services/api-client"
export type {
  Contact, ContactListResponse, ContactFormData,
  ContactEmailRow, ContactPhoneRow, DynamicLinkRow,
} from "../types"
export { CONTACT_FIELDS } from "../types"

function buildListUrl(
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

async function fetchLinkOptions(doctype: string): Promise<string[]> {
  const rows = await apiClient<Array<{ name: string }>>(
    buildListUrl(doctype, { fields: ["name"], order_by: "name asc", limit_page_length: 0 })
  )
  return rows.map((r) => r.name)
}

export const contactLookups = {
  salutations: () => fetchLinkOptions("Salutation"),
  genders: () => fetchLinkOptions("Gender"),
  users: () => fetchLinkOptions("User"),
}

interface ContactRow {
  name: string
  first_name: string
  middle_name?: string
  last_name?: string
  full_name?: string
  email_id?: string
  phone?: string
  mobile_no?: string
  user?: string
  address?: string
  status: string
  salutation?: string
  designation?: string
  gender?: string
  company_name?: string
  image?: string
  is_primary_contact: 0 | 1
  is_billing_contact: 0 | 1
  department?: string
  unsubscribed: 0 | 1
  creation: string
  modified: string
}

function normalizeContact(row: ContactRow): Contact {
  return {
    ...row,
    email_ids: [],
    phone_nos: [],
    links: [],
    status: (row.status || "Passive") as Contact["status"],
  }
}

export const contactService = {
  lookups: contactLookups,

  async list(params: {
    search?: string
    page?: number
    pageSize?: number
    customerName?: string
  }): Promise<ContactListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10
    const filters: unknown[] = []
    if (params.search) {
      filters.push(["first_name", "like", `%${params.search}%`])
    }
    if (params.customerName) {
      filters.push(["Dynamic Link", "link_name", "=", params.customerName])
      filters.push(["Dynamic Link", "link_doctype", "=", "Customer"])
    }

    const [rows, total] = await Promise.all([
      apiClient<ContactRow[]>(
        buildListUrl("Contact", {
          fields: [
            "name", "first_name", "middle_name", "last_name", "full_name",
            "email_id", "phone", "mobile_no", "company_name",
            "is_primary_contact", "creation", "modified",
          ],
          filters: filters.length > 0 ? filters : undefined,
          limit_page_length: pageSize,
          limit_start: (page - 1) * pageSize,
          order_by: "modified desc",
        })
      ),
      getCount("Contact", filters.length > 0 ? filters : undefined),
    ])

    const items = rows.map(normalizeContact)
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  },

  async getById(name: string): Promise<Contact> {
    const [fullDoc, emailRows, phoneRows, linkRows] = await Promise.all([
      apiClient<ContactRow>(`/resource/Contact/${encodeURIComponent(name)}`),
      apiClient<ContactEmailRow[]>(
        buildListUrl("Contact Email", {
          fields: ["name", "email_id", "is_primary"],
          filters: [["parent", "=", name]],
        })
      ).catch(() => [] as ContactEmailRow[]),
      apiClient<ContactPhoneRow[]>(
        buildListUrl("Contact Phone", {
          fields: ["name", "phone", "is_primary_mobile_no"],
          filters: [["parent", "=", name]],
        })
      ).catch(() => [] as ContactPhoneRow[]),
      apiClient<DynamicLinkRow[]>(
        buildListUrl("Dynamic Link", {
          fields: ["name", "link_doctype", "link_name", "link_title"],
          filters: [["parent", "=", name]],
        })
      ).catch(() => [] as DynamicLinkRow[]),
    ])

    return {
      ...fullDoc,
      email_ids: emailRows,
      phone_nos: phoneRows,
      links: linkRows,
      status: (fullDoc.status || "Passive") as Contact["status"],
    }
  },

  async create(data: ContactFormData): Promise<Contact> {
    const body: Record<string, unknown> = {
      first_name: data.first_name,
      middle_name: data.middle_name || "",
      last_name: data.last_name || "",
      salutation: data.salutation || "",
      designation: data.designation || "",
      gender: data.gender || "",
      company_name: data.company_name || "",
      department: data.department || "",
      is_primary_contact: data.is_primary_contact ? 1 : 0,
      is_billing_contact: data.is_billing_contact ? 1 : 0,
      email_ids: data.email_ids,
      phone_nos: data.phone_nos,
      links: data.links,
    }

    const row = await apiClient<ContactRow>("/resource/Contact", {
      method: "POST",
      body: JSON.stringify(body),
    })
    return normalizeContact(row)
  },

  async update(name: string, data: ContactFormData): Promise<Contact> {
    const body: Record<string, unknown> = {
      first_name: data.first_name,
      middle_name: data.middle_name || "",
      last_name: data.last_name || "",
      salutation: data.salutation || "",
      designation: data.designation || "",
      gender: data.gender || "",
      company_name: data.company_name || "",
      department: data.department || "",
      is_primary_contact: data.is_primary_contact ? 1 : 0,
      is_billing_contact: data.is_billing_contact ? 1 : 0,
      email_ids: data.email_ids,
      phone_nos: data.phone_nos,
      links: data.links,
    }

    const row = await apiClient<ContactRow>(
      `/resource/Contact/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify(body) }
    )
    return normalizeContact(row)
  },

  async delete(name: string): Promise<void> {
    return apiClient<void>(`/resource/Contact/${encodeURIComponent(name)}`, {
      method: "DELETE",
    })
  },
}
