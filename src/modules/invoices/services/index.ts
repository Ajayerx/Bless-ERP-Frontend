import { apiClient } from "@/services/api-client"
import { getCompany } from "@/services/company"
import { getDefaultTaxTemplate as sharedGetDefault, getTaxTemplateDetails as sharedGetDetails, DEFAULT_GST_RATE, DEFAULT_QST_RATE } from "@/services/tax-template"
import type { SalesInvoice, SalesInvoiceFormData, SalesInvoiceItem, SalesInvoiceTax, SalesInvoiceListResponse } from "../types"

export type { SalesInvoice, SalesInvoiceFormData, SalesInvoiceItem, SalesInvoiceTax, SalesInvoiceListResponse }

interface DocTypeOption {
  name: string
}

async function fetchOptions(doctype: string, filters?: unknown[]): Promise<string[]> {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(["name"]))
  qp.set("limit_page_length", "500")
  if (filters) qp.set("filters", JSON.stringify(filters))
  const items = await apiClient<DocTypeOption[]>(`/resource/${encodeURIComponent(doctype)}?${qp.toString()}`)
  return items.map((i) => i.name)
}

const SALES_DOCTYPE = "Sales Taxes and Charges Template"

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
  const result = await apiClient<number | string>(`/method/frappe.client.get_count?${qp.toString()}`)
  return Number(result)
}

function toLegacyShape(result: { name: string; rows: { accountHead: string; rate: number }[] }): { name: string; gstRate: number; qstRate: number } {
  const gstRow = result.rows.find((r) => r.accountHead?.toLowerCase().includes("gst"))
  const qstRow = result.rows.find((r) => r.accountHead?.toLowerCase().includes("qst"))
  return {
    name: result.name,
    gstRate: gstRow?.rate ?? DEFAULT_GST_RATE,
    qstRate: qstRow?.rate ?? DEFAULT_QST_RATE,
  }
}

const LIST_FIELDS = [
  "name", "customer", "customer_name", "posting_date", "due_date",
  "grand_total", "total_taxes_and_charges", "outstanding_amount", "status", "docstatus",
  "currency", "company",
]

const DETAIL_FIELDS = [
  ...LIST_FIELDS,
  "posting_time", "conversion_rate", "price_list_currency", "plc_conversion_rate",
  "set_warehouse", "update_stock", "net_total", "total_taxes_and_charges",
  "rounded_total", "in_words", "taxes_and_charges", "tax_category",
  "customer_address", "shipping_address_name", "contact_person",
  "contact_email", "contact_mobile", "po_no", "po_date",
  "payment_terms_template", "apply_discount_on", "discount_amount",
  "additional_discount_percentage", "coupon_code", "additional_discount_account",
  "write_off_amount", "write_off_account", "write_off_cost_center",
  "cost_center", "project", "debit_to",
  // Phase D
  "sales_partner", "commission_rate", "total_commission",
  "redeem_loyalty_points", "loyalty_program", "loyalty_points", "loyalty_amount",
  "redemption_account", "redemption_cost_center",
  "letter_head", "group_same_items", "select_print_heading", "language",
  "tc_name", "terms",
  // Phase E
  "is_return", "return_against", "is_debit_note",
  "allocate_advances_automatically", "only_include_allocated_payments",
  "is_pos", "pos_profile", "account_for_change_amount",
  "subscription", "from_date", "to_date", "auto_repeat",
  "is_opening", "customer_group", "remarks",
]

export interface PartyDetailsResponse {
  customer: string
  customer_name: string
  customer_group?: string
  territory?: string
  language?: string
  tax_id?: string
  customer_address?: string
  address_display?: string
  shipping_address_name?: string
  shipping_address?: string
  contact_person?: string
  contact_display?: string
  contact_email?: string
  contact_mobile?: string
  contact_phone?: string
  contact_designation?: string
  contact_department?: string
  company_address?: string
  company_address_display?: string
  tax_category?: string
  payment_terms_template?: string
  selling_price_list?: string
  price_list_currency?: string
  currency?: string
  due_date?: string
  debit_to?: string
  taxes_and_charges?: string
  sales_team?: Array<{ sales_person: string; allocated_percentage?: number; commission_rate?: number }>
}

export const invoiceService = {
  lookups: {
    async addresses(customerName: string): Promise<DocTypeOption[]> {
      const qp = new URLSearchParams()
      qp.set("fields", JSON.stringify(["name", "address_title", "address_line1", "city", "address_type"]))
      qp.set("filters", JSON.stringify([["Dynamic Link", "link_doctype", "=", "Customer"], ["Dynamic Link", "link_name", "=", customerName]]))
      qp.set("limit_page_length", "50")
      return apiClient<DocTypeOption[]>(`/resource/Address?${qp.toString()}`)
    },
    async contacts(customerName: string): Promise<DocTypeOption[]> {
      const qp = new URLSearchParams()
      qp.set("fields", JSON.stringify(["name", "full_name", "email_id", "mobile_no"]))
      qp.set("filters", JSON.stringify([["Dynamic Link", "link_doctype", "=", "Customer"], ["Dynamic Link", "link_name", "=", customerName]]))
      qp.set("limit_page_length", "50")
      return apiClient<DocTypeOption[]>(`/resource/Contact?${qp.toString()}`)
    },
    paymentTermsTemplates: (): Promise<string[]> => fetchOptions("Payment Terms Template"),
    taxCategories: (): Promise<string[]> => fetchOptions("Tax Category"),
    taxesAndChargesTemplates: (): Promise<string[]> => fetchOptions("Sales Taxes and Charges Template"),
    couponCodes: (): Promise<string[]> => fetchOptions("Coupon Code"),
    accounts: async (): Promise<string[]> => {
      const company = await getCompany()
      return fetchOptions("Account", [["is_group", "=", 0], ["company", "=", company]])
    },
    costCenters: (): Promise<string[]> => fetchOptions("Cost Center"),
    terms: (): Promise<string[]> => fetchOptions("Terms and Conditions"),
    letterHeads: (): Promise<string[]> => fetchOptions("Letter Head"),
    salesPartners: (): Promise<string[]> => fetchOptions("Sales Partner"),
    salesPersons: (): Promise<string[]> => fetchOptions("Sales Person"),
    loyaltyPrograms: (): Promise<string[]> => fetchOptions("Loyalty Program"),
    printHeadings: (): Promise<string[]> => fetchOptions("Print Heading"),
    itemTaxTemplates: (): Promise<string[]> => fetchOptions("Item Tax Template"),
    shippingRules: (): Promise<string[]> => fetchOptions("Shipping Rule"),
    incoterms: (): Promise<string[]> => fetchOptions("Incoterm"),
    warehouses: async (): Promise<string[]> => {
      const company = await getCompany()
      return fetchOptions("Warehouse", [["is_group", "=", 0], ["company", "=", company]])
    },
  },

  async getDefaultTaxTemplate(): Promise<{ name: string; gstRate: number; qstRate: number } | null> {
    const result = await sharedGetDefault(SALES_DOCTYPE)
    if (!result) return null
    return toLegacyShape(result)
  },

  async getTaxTemplateDetails(name: string): Promise<{ name: string; gstRate: number; qstRate: number } | null> {
    const result = await sharedGetDetails(SALES_DOCTYPE, name)
    if (!result) return null
    return toLegacyShape(result)
  },
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
    status?: string
    customerId?: string
  }): Promise<SalesInvoiceListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10
    const filters: unknown[] = []

    if (params.search) {
      filters.push(["customer_name", "like", `%${params.search}%`])
    }
    if (params.customerId) {
      filters.push(["customer", "=", params.customerId])
    }
    if (params.status && params.status !== "all") {
      const statusMap: Record<string, string> = {
        paid: "Paid",
        unpaid: "Unpaid",
        overdue: "Overdue",
        draft: "Draft",
        cancelled: "Cancelled",
        submitted: "Submitted",
      }
      const mapped = statusMap[params.status.toLowerCase()] || params.status
      filters.push(["status", "=", mapped])
    }

    const [rows, total] = await Promise.all([
      apiClient<SalesInvoice[]>(
        buildListUrl("Sales Invoice", {
          fields: LIST_FIELDS,
          filters: filters.length > 0 ? filters : undefined,
          limit_page_length: pageSize,
          limit_start: (page - 1) * pageSize,
          order_by: "posting_date desc",
        })
      ),
      getCount("Sales Invoice", filters.length > 0 ? filters : undefined),
    ])

    return {
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getById(name: string): Promise<SalesInvoice> {
    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify(DETAIL_FIELDS))
    return apiClient<SalesInvoice>(`/resource/Sales Invoice/${encodeURIComponent(name)}?${qp.toString()}`)
  },

  async create(data: SalesInvoiceFormData): Promise<SalesInvoice> {
    return apiClient<SalesInvoice>("/resource/Sales Invoice", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        update_stock: data.update_stock ? 1 : 0,
      }),
    })
  },

  async update(name: string, data: Partial<SalesInvoiceFormData>): Promise<SalesInvoice> {
    return apiClient<SalesInvoice>(`/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({
        ...data,
        update_stock: data.update_stock !== undefined ? (data.update_stock ? 1 : 0) : undefined,
      }),
    })
  },

  async submit(name: string): Promise<SalesInvoice> {
    return apiClient<SalesInvoice>(`/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ docstatus: 1 }),
    })
  },

  async cancel(name: string): Promise<void> {
    return apiClient<void>("/method/frappe.client.cancel", {
      method: "POST",
      body: JSON.stringify({ doctype: "Sales Invoice", name }),
    })
  },

  async amend(name: string): Promise<SalesInvoice> {
    return apiClient<SalesInvoice>("/method/frappe.client.amend", {
      method: "POST",
      body: JSON.stringify({ doctype: "Sales Invoice", docname: name }),
    })
  },

  async delete(name: string): Promise<void> {
    return apiClient<void>(`/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: "DELETE",
    })
  },

  async getPartyDetails(party: string, company: string, postingDate: string): Promise<PartyDetailsResponse> {
    return apiClient<PartyDetailsResponse>("/method/erpnext.accounts.party.get_party_details", {
      method: "POST",
      body: JSON.stringify({
        party,
        party_type: "Customer",
        company,
        posting_date: postingDate,
        doctype: "Sales Invoice",
      }),
    })
  },

  async getExchangeRate(fromCurrency: string, toCurrency: string, date: string): Promise<number> {
    try {
      const result = await apiClient<number>("/method/erpnext.setup.utils.get_exchange_rate", {
        method: "POST",
        body: JSON.stringify({
          from_currency: fromCurrency,
          to_currency: toCurrency,
          transaction_date: date,
        }),
      })
      return typeof result === "number" ? result : parseFloat(String(result)) || 0
    } catch {
      return 0
    }
  },

  async getDueDate(postingDate: string, party: string, company: string, templateName?: string): Promise<string | null> {
    try {
      return await apiClient<string>("/method/erpnext.accounts.party.get_due_date", {
        method: "POST",
        body: JSON.stringify({
          posting_date: postingDate,
          party_type: "Customer",
          party,
          company,
          ...(templateName ? { template_name: templateName } : {}),
        }),
      })
    } catch {
      return null
    }
  },
}
