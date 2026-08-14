import { apiClient, apiFormCall, apiClientWithBody, serverMessagesFromBody, failedNamesFromMessages, serverDownloadTemplate, ApiError, type AppMessage } from "@/services/api-client"
import { postMethod, postMethodRaw } from "@/services/frappe-client"
import { API_CONFIG } from "@/config/api.config"
import { getCompany } from "@/services/company"
import { getDefaultTaxTemplate as sharedGetDefault, getTaxTemplateDetails as sharedGetDetails } from "@/services/tax-template"
export type { TaxTemplateResult, TaxRow } from "@/services/tax-template"
import type { TaxTemplateResult, TaxRow } from "@/services/tax-template"
import type { SalesInvoice, SalesInvoiceFormData, SalesInvoiceItem, SalesInvoiceTax, SalesInvoiceListResponse, SalesInvoiceAdvance, EditableTaxRow, ChargeType } from "../types"
import { buildTimelineItems, toQuillHtml } from "@/modules/payments/services"
import type { DocInfo, PaymentActivityItem, PaymentComment, LedgerPreviewData } from "@/modules/payments/types"

export type { SalesInvoice, SalesInvoiceFormData, SalesInvoiceItem, SalesInvoiceTax, SalesInvoiceListResponse, SalesInvoiceAdvance, EditableTaxRow, ChargeType }

export interface AccountInfo {
  name: string
  account_name?: string
  account_type?: string
  tax_rate?: number
}

export interface LoyaltyProgramDetails {
  loyalty_program?: string
  expense_account?: string
  cost_center?: string
  conversion_factor?: number
  [key: string]: unknown
}

interface DocTypeOption {
  name: string
}

async function fetchOptions(doctype: string, filters?: unknown[]): Promise<string[]> {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(["name"]))
  qp.set("limit_page_length", "500")
  if (filters) qp.set("filters", JSON.stringify(filters))
  try {
    const items = await apiClient<DocTypeOption[]>(`/resource/${encodeURIComponent(doctype)}?${qp.toString()}`)
    return items.map((i) => i.name)
  } catch {
    return []
  }
}

const SALES_DOCTYPE = "Sales Taxes and Charges Template"

function buildListUrl(
  doctype: string,
  params: {
    fields: string[]
    filters?: unknown[]
    orFilters?: unknown[]
    limit_page_length?: number
    limit_start?: number
    order_by?: string
  }
): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  if (params.orFilters && params.orFilters.length > 0) {
    qp.set("or_filters", JSON.stringify(params.orFilters))
  }
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent(doctype)}?${qp.toString()}`
}

// count via frappe.desk.reportview.get_count: the only count endpoint that
// accepts a top-level `or_filters` for the list search.
async function getCount(
  doctype: string,
  filters?: unknown[],
  orFilters?: unknown[]
): Promise<number> {
  const qp = new URLSearchParams()
  qp.set("doctype", doctype)
  if (filters) qp.set("filters", JSON.stringify(filters))
  if (orFilters && orFilters.length > 0) qp.set("or_filters", JSON.stringify(orFilters))
  const result = await apiClient<number | string>(
    `/method/frappe.desk.reportview.get_count?${qp.toString()}`
  )
  return Number(result)
}

const LIST_FIELDS = [
  "name", "customer", "customer_name", "posting_date", "due_date",
  "grand_total", "total_taxes_and_charges", "outstanding_amount", "status", "docstatus",
  "currency", "company",
]

// Default columns for the server-side exporter. Keys are the parent doctype
// ("Sales Invoice") and the child-table field name ("items" -> "Sales Invoice
// Item" rows), matching the ERPNext Data Export format.
export const INVOICE_EXPORT_FIELDS: Record<string, string[]> = {
  "Sales Invoice": [
    "name", "title", "customer", "customer_name", "posting_date", "due_date",
    "company", "currency", "grand_total", "total_taxes_and_charges",
    "outstanding_amount", "paid_amount", "status", "docstatus",
  ],
  items: [
    "item_code", "item_name", "qty", "rate", "amount", "uom", "warehouse",
  ],
}

const DETAIL_FIELDS = [
  ...LIST_FIELDS,
  "posting_time", "conversion_rate", "selling_price_list", "price_list_currency", "plc_conversion_rate",
  "ignore_pricing_rule", "set_warehouse", "set_target_warehouse", "update_stock", "net_total", "total_taxes_and_charges",
  "rounded_total", "in_words", "taxes_and_charges", "tax_category",
  "customer_address", "shipping_address_name", "contact_person",
  "contact_email", "contact_mobile", "po_no", "po_date",
  "payment_terms_template", "apply_discount_on", "discount_amount",
  "additional_discount_percentage", "coupon_code", "additional_discount_account",
  "is_cash_or_non_trade_discount", "disable_rounded_total", "use_company_roundoff_cost_center",
  "write_off_amount", "write_off_account", "write_off_cost_center",
  "write_off_outstanding_amount_automatically",
  "cost_center", "project", "debit_to",
  // Phase D
  "sales_partner", "commission_rate", "total_commission",
  "redeem_loyalty_points", "loyalty_program", "loyalty_points", "loyalty_amount",
  "loyalty_redemption_account", "loyalty_redemption_cost_center",
  "letter_head", "group_same_items", "select_print_heading", "language",
  "tc_name", "terms",
  // Phase E
  "is_return", "return_against", "is_debit_note",
  "update_billed_amount_in_sales_order", "update_billed_amount_in_delivery_note",
  "update_outstanding_for_self",
  "allocate_advances_automatically", "only_include_allocated_payments",
  "is_pos", "pos_profile", "account_for_change_amount",
  "subscription", "from_date", "to_date", "auto_repeat",
  "is_opening", "customer_group", "remarks",
  // Phase F: fetch_from / round-trip fields
  "title", "naming_series", "set_posting_time",
  "tax_id", "company_tax_id", "is_internal_customer", "represents_company",
  "dispatch_address_name", "contact_display",
  "company_address", "company_address_display",
  "tax_withholding_category",
  // Base currency (ERPNext-computed)
  "base_grand_total", "base_net_total", "base_total_taxes_and_charges",
  "base_rounding_adjustment", "base_rounded_total", "base_in_words",
  "total_net_weight", "rounding_adjustment",
  "base_paid_amount", "paid_amount", "base_change_amount", "change_amount",
  "base_write_off_amount", "total_advance",
  // Accounting
  "unrealized_profit_loss_account", "against_income_account",
  // Child tables
  "items", "taxes", "payments", "payment_schedule", "sales_team", "advances",
  // Display fields
  "address_display", "shipping_address", "dispatch_address",
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
  sales_partner?: string
  commission_rate?: number
  sales_team?: Array<{ sales_person: string; allocated_percentage?: number; allocated_amount?: number; commission_rate?: number; incentives?: number }>
}

function toSalesInvoiceTargetDoc(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    doctype: "Sales Invoice",
  }
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue
    const mapped =
      key === "issueDate" ? "posting_date"
      : key === "dueDate" ? "due_date"
      : key === "sellingPriceList" ? "selling_price_list"
      : key === "conversionRate" ? "conversion_rate"
      : key === "updateStock" ? "update_stock"
      : key === "isReturn" ? "is_return"
      : key === "customerName" ? "customer_name"
      : key
    out[mapped] = value
  }
  return out
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
    async companyAddresses(companyName: string): Promise<DocTypeOption[]> {
      const qp = new URLSearchParams()
      qp.set("fields", JSON.stringify(["name", "address_title", "address_line1", "city", "address_type"]))
      qp.set("filters", JSON.stringify([["Dynamic Link", "link_doctype", "=", "Company"], ["Dynamic Link", "link_name", "=", companyName]]))
      qp.set("limit_page_length", "50")
      return apiClient<DocTypeOption[]>(`/resource/Address?${qp.toString()}`)
    },
    async companyContacts(companyName: string): Promise<DocTypeOption[]> {
      const qp = new URLSearchParams()
      qp.set("fields", JSON.stringify(["name", "full_name", "email_id", "mobile_no"]))
      qp.set("filters", JSON.stringify([["Dynamic Link", "link_doctype", "=", "Company"], ["Dynamic Link", "link_name", "=", companyName]]))
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
    taxAccounts: async (): Promise<AccountInfo[]> => {
      const company = await getCompany()
      const qp = new URLSearchParams()
      qp.set("fields", JSON.stringify(["name", "account_name", "account_type", "tax_rate"]))
      qp.set("filters", JSON.stringify([
        ["is_group", "=", 0],
        ["company", "=", company],
        ["disabled", "=", 0],
        ["account_type", "in", ["Tax", "Chargeable", "Expense Account"]],
      ]))
      qp.set("limit_page_length", "500")
      return apiClient<AccountInfo[]>(`/resource/Account?${qp.toString()}`)
    },
    costCenters: (): Promise<string[]> => fetchOptions("Cost Center", [["is_group", "=", 0]]),
    terms: (): Promise<string[]> => fetchOptions("Terms and Conditions"),
    letterHeads: (): Promise<string[]> => fetchOptions("Letter Head"),
    salesPartners: (): Promise<string[]> => fetchOptions("Sales Partner"),
    salesPersons: (): Promise<string[]> => fetchOptions("Sales Person"),
    loyaltyPrograms: (): Promise<string[]> => fetchOptions("Loyalty Program"),
    printHeadings: (): Promise<string[]> => fetchOptions("Print Heading"),
    itemTaxTemplates: (): Promise<string[]> => fetchOptions("Item Tax Template"),
    shippingRules: (): Promise<string[]> => fetchOptions("Shipping Rule"),
    incoterms: (): Promise<string[]> => fetchOptions("Incoterm"),
    taxWithholdingGroups: (): Promise<string[]> => fetchOptions("Tax Withholding Category"),
    modeOfPayments: (): Promise<string[]> => fetchOptions("Mode of Payment"),
    warehouses: async (): Promise<string[]> => {
      const company = await getCompany()
      return fetchOptions("Warehouse", [["is_group", "=", 0], ["company", "=", company]])
    },
    companies: (): Promise<string[]> => fetchOptions("Company"),
    territories: (): Promise<string[]> => fetchOptions("Territory"),
    campaigns: (): Promise<string[]> => fetchOptions("Campaign"),
    sources: (): Promise<string[]> => fetchOptions("Lead Source"),
    projects: (): Promise<string[]> => fetchOptions("Project"),
    currencies: (): Promise<string[]> => fetchOptions("Currency"),
    priceLists: (): Promise<string[]> => fetchOptions("Price List", [["selling", "=", 1]]),
  },

  async fetchFieldOptions(doctype: string, fieldname: string): Promise<string[]> {
    try {
      const qp = new URLSearchParams()
      qp.set("fields", JSON.stringify(["options"]))
      qp.set("filters", JSON.stringify([["fieldname", "=", fieldname], ["parent", "=", doctype]]))
      qp.set("limit_page_length", "1")
      const result = await apiClient<Array<{ options: string }>>(
        `/resource/DocField?${qp.toString()}`
      )
      if (result && result.length > 0 && result[0].options) {
        return result[0].options.split("\n").filter(Boolean)
      }
      return []
    } catch {
      return []
    }
  },

  async searchItems(
    query: string,
    start = 0,
    pageLength = 10,
    customer?: string,
    extraFilters?: Record<string, unknown>,
  ): Promise<{
    items: Array<{ value: string; label: string; description: string }>
  }> {
    const qp = new URLSearchParams()
    qp.set("doctype", "Item")
    qp.set("txt", query || "")
    qp.set("searchfield", "name")
    qp.set("start", String(start))
    qp.set("page_len", String(pageLength))
    qp.set("as_dict", "true")
    const filters: Record<string, unknown> = {
      disabled: 0,
      has_variants: 0,
      ...(extraFilters ?? {}),
    }
    if (customer) filters["customer"] = customer
    qp.set("filters", JSON.stringify(filters))
    try {
      const result = await apiClient<
        Array<{ name: string; item_name?: string; item_group?: string; description?: string }>
      >(`/method/erpnext.controllers.queries.item_query?${qp.toString()}`)
      if (!Array.isArray(result)) return { items: [] }
      return {
        items: result.map((r) => ({
          value: r.name,
          label: r.item_name || r.name,
          description: r.description || "",
        })),
      }
    } catch {
      return { items: [] }
    }
  },

  async getDoc(doctype: string, name: string): Promise<Record<string, unknown>> {
    try {
      return await apiClient<Record<string, unknown>>(
        `/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
      )
    } catch {
      return {}
    }
  },

  async setValue(
    doctype: string,
    name: string,
    fieldname: string,
    value: string,
  ): Promise<Record<string, unknown>> {
    try {
      return await apiClient<Record<string, unknown>>(
        `/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
        {
          method: "PUT",
          body: JSON.stringify({ [fieldname]: value }),
        },
      )
    } catch {
      return {}
    }
  },

  async validateLink(
    doctype: string,
    name: string,
    fields: string[],
  ): Promise<Record<string, unknown>> {
    try {
      return await apiFormCall<Record<string, unknown>>(
        "/method/frappe.client.validate_link",
        [
          ["doctype", doctype],
          ["docname", name],
          ["fields", JSON.stringify(fields)],
        ],
        { doctype },
      )
    } catch {
      return {}
    }
  },

  async getValue(
    doctype: string,
    fieldname: string,
    filters: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      return await apiFormCall<Record<string, unknown>>(
        "/method/frappe.client.get_value",
        [
          ["doctype", doctype],
          ["fieldname", fieldname],
          ["filters", JSON.stringify(filters)],
        ],
        { doctype },
      )
    } catch {
      return {}
    }
  },

  async searchLink(
    doctype: string,
    query: string,
    extraParams?: {
      reference_doctype?: string
      link_fieldname?: string
      searchfield?: string
      filters?: Record<string, unknown>
      start?: number
      page_length?: number
      query?: string
    },
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    const fields: Array<[string, string]> = [
      ["txt", query || ""],
      ["doctype", doctype],
      ["ignore_user_permissions", "false"],
    ]
    if (extraParams?.reference_doctype) fields.push(["reference_doctype", extraParams.reference_doctype])
    if (extraParams?.link_fieldname) fields.push(["link_fieldname", extraParams.link_fieldname])
    fields.push(["page_length", String(extraParams?.page_length ?? 10)])
    if (extraParams?.filters) fields.push(["filters", JSON.stringify(extraParams.filters)])
    if (extraParams?.query) fields.push(["query", extraParams.query])
    fields.push(["searchfield", extraParams?.searchfield ?? "name"])
    try {
      const result = await apiFormCall<Array<{ value: string; label: string; description: string }>>(
        "/method/frappe.desk.search.search_link",
        fields,
        { doctype },
      )
      return { items: Array.isArray(result) ? result : [] }
    } catch {
      return { items: [] }
    }
  },

  searchWarehouses(query: string): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("Warehouse", query, { filters: { is_group: 0 } })
  },

  // Byte-parity with ERPNext's SI Warehouse link field: search_link with
  // txt/doctype/ignore_user_permissions/reference_doctype/page_length/filters.
  // txt is always sent first (even empty) — it is a required arg of
  // search_link and its omission raises a 500.
  async searchWarehousesForInvoice(
    query: string,
    company?: string,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    const fields: Array<[string, string]> = [["txt", query]]
    fields.push(["doctype", "Warehouse"])
    fields.push(["ignore_user_permissions", "0"])
    fields.push(["reference_doctype", "Sales Invoice"])
    fields.push(["page_length", "10"])
    fields.push([
      "filters",
      JSON.stringify([
        ["Warehouse", "company", "in", ["", company ?? ""]],
        ["Warehouse", "is_group", "=", 0],
      ]),
    ])
    try {
      const result = await apiFormCall<Array<{ value: string; label: string; description: string }>>(
        "/method/frappe.desk.search.search_link",
        fields,
        { doctype: "Warehouse" },
      )
      return { items: Array.isArray(result) ? result : [] }
    } catch {
      return { items: [] }
    }
  },

  // Byte-parity with ERPNext's SI "additional_discount_account" link field
  // (sales_invoice.js set_query): search_link with the same field order,
  // ignore_user_permissions=0, reference_doctype and the
  // {company, is_group, report_type: "Profit and Loss"} filters. No searchfield.
  async searchDiscountAccounts(
    query: string,
    company?: string,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    const fields: Array<[string, string]> = [
      ["txt", query],
      ["doctype", "Account"],
      ["ignore_user_permissions", "0"],
      ["reference_doctype", "Sales Invoice"],
      ["page_length", "10"],
      [
        "filters",
        JSON.stringify({
          company: company ?? "",
          is_group: 0,
          report_type: "Profit and Loss",
        }),
      ],
    ]
    try {
      const result = await apiFormCall<Array<{ value: string; label: string; description: string }>>(
        "/method/frappe.desk.search.search_link",
        fields,
        { doctype: "Account" },
      )
      return { items: Array.isArray(result) ? result : [] }
    } catch {
      return { items: [] }
    }
  },

  // Byte-parity with ERPNext's SI "taxes_and_charges" Link field
  // (transaction.js set_query: company + docstatus != 2). Same search_link
  // envelope as searchDiscountAccounts; filters as a JSON array.
  async searchTaxTemplates(
    query: string,
    company?: string,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    const fields: Array<[string, string]> = [
      ["txt", query],
      ["doctype", "Sales Taxes and Charges Template"],
      ["ignore_user_permissions", "0"],
      ["reference_doctype", "Sales Invoice"],
      ["page_length", "10"],
      [
        "filters",
        JSON.stringify([
          ["company", "=", company ?? ""],
          ["docstatus", "!=", 2],
        ]),
      ],
    ]
    try {
      const result = await apiFormCall<Array<{ value: string; label: string; description: string }>>(
        "/method/frappe.desk.search.search_link",
        fields,
        { doctype: "Sales Taxes and Charges Template" },
      )
      return { items: Array.isArray(result) ? result : [] }
    } catch {
      return { items: [] }
    }
  },

  // Byte-parity with ERPNext's SI "select_print_heading" Link field (no
  // custom query in sales_invoice.js). Same search_link envelope.
  async searchPrintHeadings(
    query: string,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    const fields: Array<[string, string]> = [
      ["txt", query],
      ["doctype", "Print Heading"],
      ["ignore_user_permissions", "0"],
      ["reference_doctype", "Sales Invoice"],
      ["page_length", "10"],
    ]
    try {
      const result = await apiFormCall<Array<{ value: string; label: string; description: string }>>(
        "/method/frappe.desk.search.search_link",
        fields,
        { doctype: "Print Heading" },
      )
      return { items: Array.isArray(result) ? result : [] }
    } catch {
      return { items: [] }
    }
  },

  // Byte-parity generic for SI Link fields. Same search_link envelope as the
  // ERPNext captures (ignore_user_permissions=0, reference_doctype=Sales
  // Invoice, page_length=10, NO searchfield). filters optional, JSON-stringified.
  async searchSalesLink(
    doctype: string,
    query: string,
    filters?: unknown,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    const fields: Array<[string, string]> = [
      ["txt", query],
      ["doctype", doctype],
      ["ignore_user_permissions", "0"],
      ["reference_doctype", "Sales Invoice"],
      ["page_length", "10"],
    ]
    if (filters) fields.push(["filters", JSON.stringify(filters)])
    try {
      const result = await apiFormCall<Array<{ value: string; label: string; description: string }>>(
        "/method/frappe.desk.search.search_link",
        fields,
        { doctype },
      )
      return { items: Array.isArray(result) ? result : [] }
    } catch {
      return { items: [] }
    }
  },

  // Byte-parity with ERPNext's item-row warehouse selection: get_bin_details
  // with item_code + warehouse only (no company arg → response lacks
  // company_total_stock). Populates the row's read-only actual_qty.
  async getBinDetails(
    itemCode: string,
    warehouse: string,
  ): Promise<{ projected_qty: number; actual_qty: number; reserved_qty: number } | null> {
    try {
      return await apiFormCall<{ projected_qty: number; actual_qty: number; reserved_qty: number }>(
        "/method/erpnext.stock.get_item_details.get_bin_details",
        [
          ["item_code", itemCode],
          ["warehouse", warehouse],
        ],
      )
    } catch {
      return null
    }
  },

  searchAccounts(query: string): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("Account", query, { filters: { is_group: 0 } })
  },

  searchTaxAccounts(
    query: string,
    company?: string,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("Account", query, {
      filters: {
        is_group: 0,
        disabled: 0,
        ...(company ? { company } : {}),
        account_type: ["in", ["Tax", "Chargeable", "Expense Account"]],
      },
    })
  },

  searchCostCenters(query: string): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("Cost Center", query)
  },

  searchCustomerAddresses(
    customer: string,
    query: string,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("Address", query, {
      query: "frappe.contacts.doctype.address.address.address_query",
      filters: {
        link_doctype: "Customer",
        link_name: customer,
      },
      reference_doctype: "Sales Invoice",
    })
  },

  searchCustomerContacts(
    customer: string,
    query: string,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("Contact", query, {
      query: "frappe.contacts.doctype.contact.contact.contact_query",
      filters: {
        link_doctype: "Customer",
        link_name: customer,
      },
      reference_doctype: "Sales Invoice",
    })
  },

  searchCompanyAddresses(
    company: string,
    query: string,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("Address", query, {
      query: "frappe.contacts.doctype.address.address.address_query",
      filters: {
        link_doctype: "Company",
        link_name: company,
      },
      reference_doctype: "Sales Invoice",
    })
  },

  searchCompanyContacts(
    company: string,
    query: string,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("Contact", query, {
      query: "frappe.contacts.doctype.contact.contact.contact_query",
      filters: {
        link_doctype: "Company",
        link_name: company,
      },
      reference_doctype: "Sales Invoice",
    })
  },

  // Byte-parity for the Sales Person Link column inside the Sales Team grid
  // (ERPNext sales_invoice.js set_query: filters {is_group: 0, enabled: 1}).
  // Same search_link envelope as searchPaymentTerms: doctype=Sales Person,
  // reference_doctype=Sales Team (the child table), page_length=10, filters.
  async searchSalesTeamPersons(
    query: string,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    try {
      const result = await apiFormCall<Array<{ value: string; label: string; description: string }>>(
        "/method/frappe.desk.search.search_link",
        [
          ["txt", query],
          ["doctype", "Sales Person"],
          ["ignore_user_permissions", "0"],
          ["reference_doctype", "Sales Team"],
          ["page_length", "10"],
          [
            "filters",
            JSON.stringify([
              ["Sales Person", "is_group", "=", 0],
              ["Sales Person", "enabled", "=", 1],
            ]),
          ],
        ],
        { doctype: "Sales Person" },
      )
      return { items: Array.isArray(result) ? result : [] }
    } catch {
      return { items: [] }
    }
  },

  searchActivityTypes(query: string): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("Activity Type", query)
  },

  searchModesOfPayment(query: string): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("Mode of Payment", query)
  },

  searchUOMs(query: string): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("UOM", query)
  },

  searchItemTaxTemplates(query: string): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    return this.searchLink("Item Tax Template", query)
  },

  async searchSalesInvoices(query: string, filters?: Record<string, string>, start = 0, pageLength = 10): Promise<{
    items: Array<{ value: string; label: string; description: string }>
  }> {
    const qp = new URLSearchParams()
    qp.set("txt", query || "")
    qp.set("doctype", "Sales Invoice")
    qp.set("searchfield", "name")
    qp.set("start", String(start))
    qp.set("page_length", String(pageLength))
    if (filters) {
      qp.set("filters", JSON.stringify(filters))
    }
    try {
      const result = await apiClient<Array<{ value: string; label: string; description: string }>>(
        `/method/frappe.desk.search.search_link?${qp.toString()}`
      )
      return { items: Array.isArray(result) ? result : [] }
    } catch {
      return { items: [] }
    }
  },

  async getItemDetails(
    itemCode: string,
    context?: {
      currency?: string;
      conversion_rate?: number;
      selling_price_list?: string;
      price_list_currency?: string;
      plc_conversion_rate?: number;
      customer?: string;
      is_pos?: number;
      is_return?: number;
      name?: string;
    },
  ): Promise<Record<string, unknown> | null> {
    try {
      const company = (await getCompany()) || ""
      return await apiClient<Record<string, unknown>>(
        "/method/erpnext.stock.get_item_details.get_item_details",
        {
          method: "POST",
          body: JSON.stringify({
            args: {
              item_code: itemCode,
              company,
              doctype: "Sales Invoice",
              name: context?.name || "new-sales-invoice-1",
              currency: context?.currency,
              conversion_rate: context?.conversion_rate ?? 1,
              selling_price_list: context?.selling_price_list,
              price_list_currency: context?.price_list_currency,
              plc_conversion_rate: context?.plc_conversion_rate ?? 1,
              customer: context?.customer,
              is_pos: context?.is_pos ?? 0,
              is_return: context?.is_return ?? 0,
            },
          }),
        },
      )
    } catch {
      return null
    }
  },

  async getItemTaxTemplate(args: {
    item_code: string;
    company?: string;
    base_net_rate?: number;
    tax_category?: string;
    item_tax_template?: string;
    posting_date?: string;
    bill_date?: string;
    transaction_date?: string;
  }): Promise<string | null> {
    try {
      const company = args.company || (await getCompany()) || ""
      const result = await apiClient<string>(
        "/method/erpnext.stock.get_item_details.get_item_tax_template",
        {
          method: "POST",
          body: JSON.stringify({
            args: {
              item_code: args.item_code,
              company,
              base_net_rate: args.base_net_rate,
              tax_category: args.tax_category,
              item_tax_template: args.item_tax_template,
              posting_date: args.posting_date,
              bill_date: args.bill_date,
              transaction_date: args.transaction_date,
            },
          }),
        },
      )
      return typeof result === "string" ? result : null
    } catch {
      return null
    }
  },

  async getAddressDisplay(addressName: string): Promise<string> {
    try {
      const qp = new URLSearchParams()
      qp.set("address_dict", addressName)
      const result = await apiClient<string>(
        `/method/frappe.contacts.doctype.address.address.get_address_display?${qp.toString()}`
      )
      return typeof result === "string" ? result : ""
    } catch {
      return ""
    }
  },

  async getContactDetails(contactName: string): Promise<{
    contact_display?: string
    contact_email?: string
    contact_mobile?: string
    contact_phone?: string
    contact_designation?: string
    contact_department?: string
  }> {
    try {
      const qp = new URLSearchParams()
      qp.set("contact", contactName)
      const result = await apiClient<Record<string, unknown>>(
        `/method/frappe.contacts.doctype.contact.contact.get_contact_details?${qp.toString()}`
      )
      const r = (result && typeof result === "object" && !Array.isArray(result)) ? result : {}
      return {
        contact_display: (r.contact_display as string) || (r.contact_person as string) || undefined,
        contact_email: (r.contact_email as string) || undefined,
        contact_mobile: (r.contact_mobile as string) || undefined,
        contact_phone: (r.contact_phone as string) || undefined,
        contact_designation: (r.contact_designation as string) || undefined,
        contact_department: (r.contact_department as string) || undefined,
      }
    } catch {
      return {}
    }
  },

  async getTaxRate(accountHead: string): Promise<{ tax_rate: number; account_name: string }> {
    try {
      return await apiClient<{ tax_rate: number; account_name: string }>(
        `/method/erpnext.controllers.accounts_controller.get_tax_rate?account_head=${encodeURIComponent(accountHead)}`
      )
    } catch {
      return { tax_rate: 0, account_name: accountHead }
    }
  },

  async getDefaultTaxTemplate(): Promise<TaxTemplateResult | null> {
    return sharedGetDefault(SALES_DOCTYPE)
  },

  async getTaxTemplateDetails(name: string): Promise<TaxTemplateResult | null> {
    return sharedGetDetails(SALES_DOCTYPE, name)
  },

  async getAccountingDimensions(): Promise<{
    dimensionFilters: Array<{ label: string; fieldname: string; document_type: string }>
    defaultDimensionsMap: Record<string, Record<string, string>>
  }> {
    try {
      const result = await apiClient<
        [
          Array<{ label: string; fieldname: string; document_type: string }>,
          Record<string, Record<string, string>>,
        ]
      >(
        "/method/erpnext.accounts.doctype.accounting_dimension.accounting_dimension.get_dimensions",
        {
          method: "POST",
          body: JSON.stringify({ with_cost_center_and_project: true }),
        },
      )
      if (!Array.isArray(result) || result.length < 2) {
        return { dimensionFilters: [], defaultDimensionsMap: {} }
      }
      return {
        dimensionFilters: result[0] || [],
        defaultDimensionsMap: result[1] || {},
      }
    } catch {
      return { dimensionFilters: [], defaultDimensionsMap: {} }
    }
  },

  async applyPriceList(
    args: Record<string, unknown>,
    doc?: Record<string, unknown>,
  ): Promise<{
    parent: Record<string, unknown>
    children: Array<Record<string, unknown>>
  } | null> {
    try {
      return await apiClient<{
        parent: Record<string, unknown>
        children: Array<Record<string, unknown>>
      }>("/method/erpnext.stock.get_item_details.apply_price_list", {
        method: "POST",
        body: JSON.stringify({ args, doc: doc || {} }),
      })
    } catch {
      return null
    }
  },

  async getDefaultCompanyAddress(company: string, existingAddress?: string): Promise<string | null> {
    try {
      const result = await apiClient<string>(
        "/method/erpnext.setup.doctype.company.company.get_default_company_address",
        {
          method: "POST",
          body: JSON.stringify({
            name: company,
            existing_address: existingAddress || "",
          }),
        },
      )
      return typeof result === "string" && result ? result : null
    } catch {
      return null
    }
  },

  async getDefaultTaxesAndCharges(
    company: string,
    taxTemplate?: string,
  ): Promise<{
    taxes_and_charges: string
    taxes: Array<Record<string, unknown>>
  } | null> {
    try {
      const result = await apiFormCall<{
        taxes_and_charges: string
        taxes: Array<Record<string, unknown>>
      }>("/method/erpnext.controllers.accounts_controller.get_default_taxes_and_charges", [
        ["master_doctype", SALES_DOCTYPE],
        ["tax_template", taxTemplate || ""],
        ["company", company],
      ])
      if (!result || typeof result !== "object") return null
      return {
        taxes_and_charges: result.taxes_and_charges || "",
        taxes: Array.isArray(result.taxes) ? result.taxes : [],
      }
    } catch {
      return null
    }
  },
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
    start?: number
    pageLength?: number
    status?: string
    customerId?: string
    postingDateFrom?: string
    postingDateTo?: string
    assignedTo?: string
    name?: string
    sortBy?: string
    sortOrder?: "asc" | "desc"
  }): Promise<SalesInvoiceListResponse> {
    const pageSize = params.pageLength ?? params.pageSize ?? 10
    const limit_start = params.start != null ? params.start : ((params.page ?? 1) - 1) * pageSize
    const filters: unknown[] = []

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
    if (params.postingDateFrom) {
      filters.push(["posting_date", ">=", params.postingDateFrom])
    }
    if (params.postingDateTo) {
      filters.push(["posting_date", "<=", params.postingDateTo])
    }
    if (params.assignedTo) {
      filters.push(["_assign", "like", `%${params.assignedTo}%`])
    }
    if (params.name) {
      filters.push(["name", "=", params.name])
    }

    // Frappe splits the list search into a top-level `or_filters` group.
    const orFilters: unknown[] = []
    if (params.search) {
      const like = `%${params.search}%`
      orFilters.push(
        ["name", "like", like],
        ["customer", "like", like],
        ["customer_name", "like", like]
      )
    }

    const order_by = params.sortBy
      ? `${params.sortBy} ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
      : "posting_date desc"

    const computedPage = params.page ?? (params.start != null ? Math.floor(params.start / pageSize) + 1 : 1)

    const [rows, total] = await Promise.all([
      apiClient<SalesInvoice[]>(
        buildListUrl("Sales Invoice", {
          fields: LIST_FIELDS,
          filters: filters.length > 0 ? filters : undefined,
          orFilters: orFilters.length > 0 ? orFilters : undefined,
          limit_page_length: pageSize,
          limit_start,
          order_by,
        })
      ),
      getCount(
        "Sales Invoice",
        filters.length > 0 ? filters : undefined,
        orFilters.length > 0 ? orFilters : undefined
      ),
    ])

    return {
      items: rows,
      total,
      page: computedPage,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async exportRecords(options?: {
    fileType?: "CSV" | "Excel"
    recordMode?: "all" | "by_filter" | "5_records" | "blank_template"
    fields?: Record<string, string[]>
    filters?: unknown[]
  }): Promise<Blob> {
    return serverDownloadTemplate({
      doctype: "Sales Invoice",
      fileType: options?.fileType ?? "CSV",
      recordMode: options?.recordMode ?? "by_filter",
      fields: options?.fields && Object.keys(options.fields).length > 0
        ? options.fields
        : INVOICE_EXPORT_FIELDS,
      filters: options?.filters,
    })
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

  // Update a Submitted/Paid invoice without touching docstatus. ERPNext only
  // permits allow_on_submit fields on docstatus=1, so callers must send a
  // slim payload of exactly those fields (built by the workspace).
  async updateSubmitted(name: string, payload: Record<string, unknown>): Promise<SalesInvoice> {
    return apiClient<SalesInvoice>(`/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  },

  async submit(name: string): Promise<SalesInvoice> {
    return apiClient<SalesInvoice>(`/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ docstatus: 1 }),
    })
  },

  async cancel(name: string): Promise<void> {
    // ERPNext frappe.client.cancel can return HTTP 200 with the human reason in
    // `_server_messages` (e.g. "Cannot delete or cancel because ... is linked
    // with GL Entry ..."). apiClient would swallow those, so surface them here.
    const body = await apiClientWithBody<{ _server_messages?: unknown } & Record<string, unknown>>(
      "/method/frappe.client.cancel",
      { method: "POST", body: JSON.stringify({ doctype: "Sales Invoice", name }) },
    )
    const messages = serverMessagesFromBody(body)
    if (messages.length > 0) {
      throw new ApiError(0, messages.map((m) => m.message).join(" "), undefined, messages[0])
    }
  },

  async amend(name: string): Promise<SalesInvoice> {
    // ERPNext amend flow: GET cancelled doc → clean framework fields → POST with amended_from
    const doc = await apiClient<Record<string, unknown>>(
      `/resource/Sales Invoice/${encodeURIComponent(name)}`
    )

    const managedFields = new Set([
      "name", "creation", "modified", "modified_by", "owner",
      "docstatus", "idx", "_comments", "_assign", "_liked_by",
    ])
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(doc)) {
      if (managedFields.has(k)) continue
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

    return apiClient<SalesInvoice>("/resource/Sales Invoice", {
      method: "POST",
      body: JSON.stringify(cleaned),
    })
  },

  async delete(name: string): Promise<void> {
    return apiClient<void>(`/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: "DELETE",
    })
  },

  async getPartyDetails(
    party: string,
    company: string,
    postingDate: string,
    opts?: {
      priceList?: string
      fetchPaymentTermsTemplate?: boolean
      currency?: string
    },
  ): Promise<PartyDetailsResponse> {
    const fields: Array<[string, string]> = [
      ["posting_date", postingDate],
      ["party", party],
      ["party_type", "Customer"],
    ]
    if (opts?.priceList) fields.push(["price_list", opts.priceList])
    fields.push([
      "fetch_payment_terms_template",
      opts?.fetchPaymentTermsTemplate === false ? "0" : "1",
    ])
    if (opts?.currency) fields.push(["currency", opts.currency])
    fields.push(["company", company])
    fields.push(["doctype", "Sales Invoice"])
    return apiFormCall<PartyDetailsResponse>(
      "/method/erpnext.accounts.party.get_party_details",
      fields,
      { doctype: "Sales Invoice" },
    )
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
      const rate = typeof result === "number" ? result : parseFloat(String(result))
      if (rate && rate > 0) return rate
      console.warn(`Exchange rate not found for ${fromCurrency}\u2192${toCurrency} on ${date}, returning 0`)
      return 0
    } catch {
      console.warn(`Exchange rate lookup failed for ${fromCurrency}\u2192${toCurrency} on ${date}, returning 0`)
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

  // Byte-parity for the Payment Term Link column inside the Payment Schedule
  // grid. Matches the ERPNext capture: doctype=Payment Term,
  // reference_doctype=Payment Schedule (the child table), page_length=10, no
  // filters. Same search_link envelope as searchSalesLink.
  async searchPaymentTerms(
    query: string,
  ): Promise<{ items: Array<{ value: string; label: string; description: string }> }> {
    try {
      const result = await apiFormCall<Array<{ value: string; label: string; description: string }>>(
        "/method/frappe.desk.search.search_link",
        [
          ["txt", query],
          ["doctype", "Payment Term"],
          ["ignore_user_permissions", "0"],
          ["reference_doctype", "Payment Schedule"],
          ["page_length", "10"],
        ],
        { doctype: "Payment Term" },
      )
      return { items: Array.isArray(result) ? result : [] }
    } catch {
      return { items: [] }
    }
  },

  // Byte-parity with transaction.js payment_terms_template(): POSTs
  // get_payment_terms with terms_template/posting_date/grand_total/
  // base_grand_total and replaces the whole payment_schedule.
  async getPaymentTerms(
    termsTemplate: string,
    postingDate: string,
    grandTotal: number,
    baseGrandTotal: number,
  ): Promise<Array<{
    payment_term?: string
    description?: string
    due_date?: string
    invoice_portion?: number
    payment_amount?: number
  }> | null> {
    try {
      const result = await apiFormCall<Array<Record<string, unknown>>>(
        "/method/erpnext.controllers.accounts_controller.get_payment_terms",
        [
          ["terms_template", termsTemplate],
          ["posting_date", postingDate],
          ["grand_total", String(grandTotal)],
          ["base_grand_total", String(baseGrandTotal)],
        ],
      )
      return Array.isArray(result) ? result : null
    } catch {
      return null
    }
  },

  // Byte-parity with transaction.js payment_term(): POSTs
  // get_payment_term_details for a single row when the Payment Term is
  // picked, auto-filling description/invoice_portion/payment_amount/due_date.
  async getPaymentTermDetails(
    term: string,
    postingDate: string,
    grandTotal: number,
    baseGrandTotal: number,
  ): Promise<Record<string, unknown> | null> {
    try {
      return await apiFormCall<Record<string, unknown>>(
        "/method/erpnext.controllers.accounts_controller.get_payment_term_details",
        [
          ["term", term],
          ["posting_date", postingDate],
          ["grand_total", String(grandTotal)],
          ["base_grand_total", String(baseGrandTotal)],
        ],
      )
    } catch {
      return null
    }
  },

  // Byte-parity with erpnext.utils.get_terms(): renders the Terms and
  // Conditions template server-side and returns the text to place in `terms`.
  async getTermsAndConditions(
    templateName: string,
    doc: Record<string, unknown>,
  ): Promise<string | null> {
    try {
      const result = await apiFormCall<string | Record<string, unknown>>(
        "/method/erpnext.setup.doctype.terms_and_conditions.terms_and_conditions.get_terms_and_conditions",
        [
          ["template_name", templateName],
          ["doc", JSON.stringify(doc)],
        ],
      )
      return typeof result === "string" ? result : null
    } catch {
      return null
    }
  },

  async getPrintFormats(): Promise<string[]> {
    try {
      const raw = await apiClient<Array<{ name: string }>>(
        `/resource/Print Format?filters=${JSON.stringify([["doc_type", "=", "Sales Invoice"], ["disabled", "=", 0]])}&fields=["name"]&limit_page_length=100`
      )
      return raw.map((f) => f.name)
    } catch {
      return ["Standard"]
    }
  },

  async generatePDF(name: string, options?: {
    printFormat?: string
    letterHead?: string
    noLetterhead?: boolean
    language?: string
  }): Promise<Blob> {
    const params = new URLSearchParams()
    params.set("doctype", "Sales Invoice")
    params.set("name", name)
    if (options?.printFormat) params.set("format", options.printFormat)
    if (options?.letterHead) params.set("letterhead", options.letterHead)
    if (options?.noLetterhead) params.set("no_letterhead", "1")
    if (options?.language) params.set("_lang", options.language)

    const res = await fetch(`${API_CONFIG.baseUrl}/method/frappe.utils.print_format.download_pdf?${params.toString()}`, {
      credentials: "include",
      headers: API_CONFIG.headers,
    })

    if (!res.ok) {
      throw new Error("Failed to generate PDF")
    }

    return res.blob()
  },

  async sendEmail(name: string, data: {
    recipients: string
    subject: string
    content: string
    printFormat?: string
  }): Promise<{ name: string }> {
    return apiClient<{ name: string }>("/method/frappe.core.doctype.communication.email.make", {
      method: "POST",
      body: JSON.stringify({
        doctype: "Sales Invoice",
        name,
        recipients: data.recipients,
        subject: data.subject,
        content: data.content,
        communication_medium: "Email",
        send_email: 1,
        print_format: data.printFormat || "Standard",
      }),
    })
  },

  // --- Get Items From (map source docs to current SI inline) ---

  async mapSourceDocuments(
    method: string,
    sourceNames: string[],
    targetDoc: Record<string, unknown>,
    args?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const mappedTarget = toSalesInvoiceTargetDoc(targetDoc)
    return apiFormCall<Record<string, unknown>>("/method/frappe.model.mapper.map_docs", [
      ["method", method],
      ["source_names", JSON.stringify(sourceNames)],
      ["target_doc", JSON.stringify(mappedTarget)],
      ["args", JSON.stringify(args ?? {})],
    ])
  },

  async searchWidget(args: {
    doctype: string
    txt?: string
    query?: string
    searchfield?: string
    start?: number
    page_length?: number
    filters?: Record<string, unknown>
    filter_fields?: string[]
    as_dict?: boolean
  }): Promise<Array<Record<string, unknown>>> {
    const fields: Array<[string, string]> = [
      ["doctype", args.doctype],
      ["txt", args.txt ?? ""],
      ...(args.query ? [["query", args.query] as [string, string]] : []),
      ...(args.searchfield ? [["searchfield", args.searchfield] as [string, string]] : []),
      ["start", String(args.start ?? 0)],
      ["page_length", String(args.page_length ?? 10)],
    ]
    if (args.filters) fields.push(["filters", JSON.stringify(args.filters)])
    if (args.filter_fields) fields.push(["filter_fields", JSON.stringify(args.filter_fields)])
    fields.push(["as_dict", args.as_dict === false ? "false" : "true"])
    return apiFormCall<Array<Record<string, unknown>>>(
      "/method/frappe.desk.search.search_widget",
      fields,
      { doctype: args.doctype },
    )
  },

  async getList(args: {
    doctype: string
    fields: string[]
    filters?: unknown[]
    parent?: string
    order_by?: string
    limit_start?: number
    limit_page_length?: number
  }): Promise<Array<Record<string, unknown>>> {
    const fields: Array<[string, string]> = [
      ["doctype", args.doctype],
      ["fields", JSON.stringify(args.fields)],
    ]
    if (args.filters) fields.push(["filters", JSON.stringify(args.filters)])
    if (args.parent !== undefined) fields.push(["parent", args.parent])
    if (args.order_by) fields.push(["order_by", args.order_by])
    fields.push(["limit_start", String(args.limit_start ?? 0)])
    fields.push(["limit_page_length", String(args.limit_page_length ?? 20)])
    return apiFormCall<Array<Record<string, unknown>>>("/method/frappe.client.get_list", fields, {
      doctype: args.doctype,
    })
  },

  async fetchTimesheetData(args: {
    from_time: string
    to_time: string
    project?: string
    item_code?: string
  }): Promise<Array<Record<string, unknown>>> {
    return apiClient<Array<Record<string, unknown>>>(
      "/method/erpnext.projects.doctype.timesheet.timesheet.get_timesheet",
      {
        method: "POST",
        body: JSON.stringify(args),
      },
    )
  },

  getProjectwiseTimesheetData(args: {
    from_time: string
    to_time: string
    project?: string
    parent?: string
  }): Promise<Array<Record<string, unknown>>> {
    return apiClient<Array<Record<string, unknown>>>(
      "/method/erpnext.projects.doctype.timesheet.timesheet.get_projectwise_timesheet_data",
      {
        method: "POST",
        body: JSON.stringify(args),
      },
    )
  },

  async getLoyaltyPrograms(customer: string): Promise<string[]> {
    try {
      const result = await apiFormCall<{ message: string[] }>(
        "/method/erpnext.accounts.doctype.sales_invoice.sales_invoice.get_loyalty_programs",
        [["customer", customer]],
      )
      return Array.isArray(result) ? result : []
    } catch {
      return []
    }
  },

  async getLoyaltyProgramDetails(args: {
    customer: string
    loyalty_program?: string
    expiry_date?: string
    company?: string
  }): Promise<LoyaltyProgramDetails> {
    const fields: Array<[string, string]> = [["customer", args.customer]]
    if (args.loyalty_program) fields.push(["loyalty_program", args.loyalty_program])
    if (args.expiry_date) fields.push(["expiry_date", args.expiry_date])
    if (args.company) fields.push(["company", args.company])
    return apiFormCall<LoyaltyProgramDetails>(
      "/method/erpnext.accounts.doctype.loyalty_program.loyalty_program.get_loyalty_program_details",
      fields,
    )
  },

  async getRedeemptionFactor(loyalty_program: string): Promise<number> {
    const result = await apiFormCall<number | string>(
      "/method/erpnext.accounts.doctype.loyalty_program.loyalty_program.get_redeemption_factor",
      [["loyalty_program", loyalty_program]],
    )
    return Number(result)
  },

  async setAdvances(doc: Record<string, unknown>): Promise<SalesInvoiceAdvance[]> {
    const body = await postMethodRaw<{ docs?: Array<{ advances?: SalesInvoiceAdvance[] } | null> }>(
      "run_doc_method",
      {
        method: "set_advances",
        docs: JSON.stringify({
          ...doc,
          doctype: "Sales Invoice",
          name: `new-sales-invoice-${crypto.randomUUID()}`,
          __islocal: 1,
          __unsaved: 1,
          docstatus: 0,
          idx: 0,
        }),
        args: JSON.stringify({}),
      },
      { "x-frappe-doctype": encodeURIComponent("Sales Invoice") },
    )
    return body.docs?.[0]?.advances ?? []
  },

  // --- Create dropdown (navigate to new doc) ---

  async makePaymentEntry(siName: string, referenceDate?: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry",
      {
        method: "POST",
        body: JSON.stringify({
          dt: "Sales Invoice",
          dn: siName,
          ...(referenceDate ? { reference_date: referenceDate } : {}),
        }),
      },
    )
  },

  async makeSalesReturn(siName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      {
        method: "POST",
        body: JSON.stringify({
          method: "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_sales_return",
          source_name: siName,
        }),
      },
    )
  },

  async makeDeliveryNote(siName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      {
        method: "POST",
        body: JSON.stringify({
          method: "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_delivery_note",
          source_name: siName,
        }),
      },
    )
  },

  async makePaymentRequest(siName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/erpnext.accounts.doctype.payment_request.payment_request.make_payment_request",
      {
        method: "POST",
        body: JSON.stringify({
          dt: "Sales Invoice",
          dn: siName,
        }),
      },
    )
  },

  async makeQualityInspections(
    siName: string,
    items: Array<{ item_code: string; qty: number; sample_size: number; child_row_reference: string }>,
  ): Promise<string[]> {
    const company = await getCompany()
    const result = await apiClient<string[]>(
      "/method/erpnext.controllers.stock_controller.make_quality_inspections",
      {
        method: "POST",
        body: JSON.stringify({
          company,
          doctype: "Sales Invoice",
          docname: siName,
          items,
        }),
      },
    )
    return Array.isArray(result) ? result : []
  },
  async getProject(projectName: string): Promise<{ is_auto_fetch_timesheet_enabled: boolean } | null> {
    try {
      const qp = new URLSearchParams()
      qp.set("fields", JSON.stringify(["is_auto_fetch_timesheet_enabled"]))
      return await apiClient<{ is_auto_fetch_timesheet_enabled: boolean }>(
        `/resource/Project/${encodeURIComponent(projectName)}?${qp.toString()}`,
      )
    } catch {
      return null
    }
  },

  async getBankCashAccount(modeOfPayment: string, company: string): Promise<string | null> {
    try {
      const result = await apiClient<{ default_account: string }>(
        "/method/erpnext.accounts.doctype.sales_invoice.sales_invoice.get_bank_cash_account",
        { method: "POST", body: JSON.stringify({ mode_of_payment: modeOfPayment, company }) },
      )
      return result?.default_account || null
    } catch {
      return null
    }
  },

  async makeInvoiceDiscounting(siName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      {
        method: "POST",
        body: JSON.stringify({
          method: "erpnext.accounts.doctype.sales_invoice.sales_invoice.create_invoice_discounting",
          source_name: siName,
        }),
      },
    )
  },

  async makeDunning(siName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      {
        method: "POST",
        body: JSON.stringify({
          method: "erpnext.accounts.doctype.sales_invoice.sales_invoice.create_dunning",
          source_name: siName,
          ignore_permissions: false,
        }),
      },
    )
  },

  async makeInterCompanyPurchaseInvoice(siName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      {
        method: "POST",
        body: JSON.stringify({
          method: "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_inter_company_purchase_invoice",
          source_name: siName,
        }),
      },
    )
  },

  async makeMaintenanceSchedule(siName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      {
        method: "POST",
        body: JSON.stringify({
          method: "erpnext.selling.doctype.sales_invoice.sales_invoice.make_maintenance_schedule",
          source_name: siName,
        }),
      },
    )
  },

  // Bulk submit/cancel via frappe.desk.doctype.bulk_update.bulk_update
  // .submit_cancel_or_update_docs (server-side batching: sync <20 docs,
  // enqueue 20-500, throws above 500). Mirrors ERPNext's list bulk actions.
  // `enqueued` is true when the server pushed the batch to the background queue.
  // `messages` carries ERPNext `_server_messages` (e.g. "Cannot delete or cancel
  // because ... is linked with GL Entry ...") even though the server reports
  // HTTP 200 with the failed docnames.
  async bulkSubmit(names: string[]): Promise<{ failed: string[]; enqueued: boolean; messages: AppMessage[] }> {
    const result = await postMethodRaw<{ message?: string[] | null; failed?: string[] } & Record<string, unknown>>(
      "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
      { doctype: "Sales Invoice", action: "submit", docnames: JSON.stringify(names) }
    )
    const msg = Array.isArray(result.message) ? result.message : []
    const messages = serverMessagesFromBody(result)
    const explicit = Array.isArray(result.failed) ? result.failed : msg
    return {
      failed: explicit.length > 0 ? explicit : failedNamesFromMessages(names, messages),
      enqueued: result.message == null,
      messages,
    }
  },

  async bulkCancel(names: string[]): Promise<{ failed: string[]; enqueued: boolean; messages: AppMessage[] }> {
    const result = await postMethodRaw<{ message?: string[] | null; failed?: string[] } & Record<string, unknown>>(
      "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
      { doctype: "Sales Invoice", action: "cancel", docnames: JSON.stringify(names) }
    )
    const msg = Array.isArray(result.message) ? result.message : []
    const messages = serverMessagesFromBody(result)
    const explicit = Array.isArray(result.failed) ? result.failed : msg
    return {
      failed: explicit.length > 0 ? explicit : failedNamesFromMessages(names, messages),
      enqueued: result.message == null,
      messages,
    }
  },

  // Bulk delete via frappe.desk.reportview.delete_items. Mirrors the ERPNext
  // list "Delete" action (allows selected docs, falls back to filtered rows).
  async bulkDelete(names: string[]): Promise<{ failed: string[]; messages: AppMessage[] }> {
    const result = await postMethodRaw<{ message?: { undeleted_items?: string[] } | string[] } & Record<string, unknown>>(
      "frappe.desk.reportview.delete_items",
      {
        doctype: "Sales Invoice",
        items: JSON.stringify(names),
      }
    )
    const msg = result.message
    const messages = serverMessagesFromBody(result)
    if (Array.isArray(msg)) return { failed: msg.length > 0 ? msg : failedNamesFromMessages(names, messages), messages }
    const undeleted = Array.isArray(msg?.undeleted_items) ? msg.undeleted_items : []
    return {
      failed: undeleted.length > 0 ? undeleted : failedNamesFromMessages(names, messages),
      messages,
    }
  },

  async getLinkedDocs(doctype: string, docname: string): Promise<Record<string, Array<{ name: string; docstatus: number }>>> {
    return apiClient<Record<string, Array<{ name: string; docstatus: number }>>>(
      "/method/frappe.model.utils.get_linked_docs",
      { method: "POST", body: JSON.stringify({ doctype, docname }) },
    )
  },

  // ── Docinfo / activity timeline (form footer) ─────────────────────

  // frappe.desk.form.load.get_docinfo — the exact endpoint ERPNext's form
  // footer uses to fetch comments + versions for the timeline.
  async getDocInfo(name: string): Promise<DocInfo> {
    const body = await apiClientWithBody<{ docinfo?: DocInfo }>(
      `/method/frappe.desk.form.load.get_docinfo?doctype=Sales%20Invoice&name=${encodeURIComponent(name)}`,
    )
    return body.docinfo ?? { comments: [], versions: [] }
  },

  // ERPNext-style timeline built from get_docinfo + the doc's own timestamps.
  async getActivity(doc: SalesInvoice, currentUserId?: string): Promise<PaymentActivityItem[]> {
    const docinfo = await this.getDocInfo(doc.name)
    return buildTimelineItems(doc, docinfo, currentUserId)
  },

  // ── Comments (frappe.desk.form.utils) ─────────────────────────────
  async addComment(
    name: string,
    content: string,
    commentEmail: string,
    commentBy: string,
  ): Promise<PaymentComment> {
    const row = await postMethod<{ name: string; content: string; owner: string; creation: string }>(
      "frappe.desk.form.utils.add_comment",
      {
        reference_doctype: "Sales Invoice",
        reference_name: name,
        content: toQuillHtml(content),
        comment_email: commentEmail,
        comment_by: commentBy,
      },
    )
    return {
      id: row.name,
      content: row.content,
      author: row.owner,
      createdAt: row.creation,
    }
  },

  async updateComment(name: string, content: string): Promise<{ name: string }> {
    return postMethod<{ name: string }>("frappe.desk.form.utils.update_comment", {
      name,
      content: toQuillHtml(content),
    })
  },

  async deleteComment(name: string): Promise<{ message: string }> {
    return postMethod<{ message: string }>("frappe.client.delete", {
      doctype: "Comment",
      name,
    })
  },

  // ── Assignment (frappe.desk.form.assign_to) ───────────────────────

  async searchAssignableUsers(
    query: string,
  ): Promise<{ value: string; label: string; description: string }[]> {
    const results = await apiClient<{ value: string; label?: string; description?: string }[]>(
      `/method/frappe.desk.search.search_link?` +
        new URLSearchParams({
          doctype: "User",
          txt: query,
          page_length: "10",
          filters: JSON.stringify({ user_type: "System User", enabled: 1 }),
        }).toString(),
    )
    return (results ?? []).map((u) => ({
      value: u.value,
      label: u.label ?? u.value,
      description: u.description ?? "",
    }))
  },

  async assignTo(names: string[], user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.add_multiple", {
      assign_to: JSON.stringify([user]),
      doctype: "Sales Invoice",
      name: JSON.stringify(names),
    })
  },

  async removeAssignment(names: string[]): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.remove_multiple", {
      doctype: "Sales Invoice",
      names: JSON.stringify(names),
    })
  },

  async assignUserToDoc(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.add", {
      assign_to: JSON.stringify([user]),
      doctype: "Sales Invoice",
      name,
    })
  },

  async unassignUserFromDoc(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.remove", {
      doctype: "Sales Invoice",
      name,
      assign_to: user,
    })
  },

  async completeOwnAssignment(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.close", {
      doctype: "Sales Invoice",
      name,
      assign_to: user,
    })
  },

  // ── Tags (frappe.desk.doctype.tag.tag) ────────────────────────────

  async addTags(names: string[], tags: string | string[], color = ""): Promise<void> {
    const tagLabels = Array.isArray(tags) ? tags : [tags]
    await postMethod("frappe.desk.doctype.tag.tag.add_tags", {
      tags: JSON.stringify(tagLabels),
      dt: "Sales Invoice",
      docs: JSON.stringify(names),
      color,
    })
  },

  async addTagToDoc(name: string, tag: string): Promise<void> {
    await postMethod("frappe.desk.doctype.tag.tag.add_tag", {
      tag,
      dt: "Sales Invoice",
      dn: name,
    })
  },

  async removeTagFromDoc(name: string, tag: string): Promise<void> {
    await postMethod("frappe.desk.doctype.tag.tag.remove_tag", {
      tag,
      dt: "Sales Invoice",
      dn: name,
    })
  },

  async searchTags(query: string): Promise<string[]> {
    try {
      return (
        (await postMethod<string[] | null>("frappe.desk.doctype.tag.tag.get_tags", {
          doctype: "Sales Invoice",
          txt: query,
        })) ?? []
      )
    } catch {
      return []
    }
  },

  async resolveUserNames(
    ids: string[],
  ): Promise<Record<string, { full_name?: string }>> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    if (uniqueIds.length === 0) return {}
    try {
      const rows = await apiClient<Array<{ name: string; full_name?: string }>>(
        `/resource/User?` +
          new URLSearchParams({
            fields: JSON.stringify(["name", "full_name"]),
            filters: JSON.stringify([["name", "in", uniqueIds]]),
            limit_page_length: String(uniqueIds.length),
          }).toString(),
      )
      const map: Record<string, { full_name?: string }> = {}
      for (const row of rows ?? []) {
        if (row?.name) map[row.name] = { full_name: row.full_name ?? row.name }
      }
      return map
    } catch {
      return {}
    }
  },

  // ── Accounting ledger preview ─────────────────────────────────────
  async getAccountingLedgerPreview(company: string, name: string): Promise<LedgerPreviewData> {
    return apiClient<LedgerPreviewData>(
      "/method/erpnext.controllers.stock_controller.show_accounting_ledger_preview",
      {
        method: "POST",
        body: JSON.stringify({ company, doctype: "Sales Invoice", docname: name }),
      },
    )
  },
}

// ---------------------------------------------------------------------------
// Tax computation utilities
// ---------------------------------------------------------------------------

/** ERPNext-style message when no Currency Exchange record exists for a date. */
export function formatExchangeRateError(
  fromCurrency: string,
  toCurrency: string,
  date: string,
): string {
  return `Unable to find exchange rate for ${fromCurrency} to ${toCurrency} for key date ${date}. Please create a Currency Exchange record manually.`
}

/** Convert TaxRow[] from a template into EditableTaxRow[] for the form. */
export function templateRowsToEditable(rows: TaxRow[]): EditableTaxRow[] {
  return rows.map((r) => ({
    charge_type: (r.chargeType || "On Net Total") as EditableTaxRow["charge_type"],
    account_head: r.accountHead,
    description: r.description ?? "",
    rate: Math.round(r.rate * 100 * 1000) / 1000,
    tax_amount: 0,
    net_amount: 0,
    total: 0,
    included_in_print_rate: !!r.includedInPrintRate,
    row_id: undefined,
  }))
}

/** Convert ERPNext invoice taxes[] into EditableTaxRow[] for editing an existing invoice. */
export function invoiceTaxesToEditable(taxes: SalesInvoiceTax[]): EditableTaxRow[] {
  return taxes.map((t) => ({
    charge_type: (t.charge_type || "On Net Total") as EditableTaxRow["charge_type"],
    account_head: t.account_head,
    description: t.description ?? "",
    rate: t.rate,
    tax_amount: t.tax_amount ?? 0,
    net_amount: 0,
    total: t.total ?? 0,
    included_in_print_rate: !!t.included_in_print_rate,
    row_id: undefined,
  }))
}

/** Convert raw tax rows from get_default_taxes_and_charges into EditableTaxRow[]. */
export function erpnextTaxesToEditable(taxes: Array<Record<string, unknown>>): EditableTaxRow[] {
  return taxes.map((t) => ({
    charge_type: (t.charge_type || "On Net Total") as EditableTaxRow["charge_type"],
    account_head: (t.account_head as string) || "",
    description: (t.description as string) ?? "",
    rate: typeof t.rate === "number" ? t.rate : parseFloat(String(t.rate)) || 0,
    tax_amount: 0,
    net_amount: 0,
    total: 0,
    included_in_print_rate: !!t.included_in_print_rate,
    row_id: undefined,
  }))
}

/** Compute tax amounts from editable rows — mirrors ERPNext server-side logic. */
export function computeTaxes(
  rows: EditableTaxRow[],
  subtotal: number,
  totalQty: number,
  opts?: {
    netTotal?: number
    applyDiscountOn?: "Grand Total" | "Net Total"
    isCashOrNonTradeDiscount?: boolean
  },
): EditableTaxRow[] {
  const netTotal = opts?.netTotal ?? subtotal
  // ERPNext keeps the pre-discount tax_amount for a Grand Total discount
  // (initialize_taxes excludes it from the recompute reset), so the displayed
  // amount is based on subtotal, while row totals use the discounted net.
  const displayBase = opts?.applyDiscountOn === "Net Total" ? netTotal : subtotal
  const runningBase =
    opts?.applyDiscountOn === "Grand Total" && opts?.isCashOrNonTradeDiscount
      ? subtotal
      : netTotal
  let runningTotal = runningBase
  return rows.map((row, i) => {
    let taxAmount = 0
    let netAmount = displayBase
    let rowAmount = 0

    switch (row.charge_type) {
      case "Actual":
        taxAmount = row.tax_amount
        rowAmount = row.tax_amount
        break
      case "On Net Total":
        taxAmount = Math.round(displayBase * (row.rate / 100) * 100) / 100
        rowAmount = Math.round(runningBase * (row.rate / 100) * 100) / 100
        break
      case "On Previous Row Amount": {
        const refIdx = (row.row_id ?? (i > 0 ? i : 1)) - 1
        const refRow = rows[refIdx]
        if (refRow) {
          taxAmount = Math.round(refRow.tax_amount * (row.rate / 100) * 100) / 100
          rowAmount = taxAmount
          netAmount = refRow.tax_amount
        }
        break
      }
      case "On Previous Row Total": {
        const refIdx = (row.row_id ?? (i > 0 ? i : 1)) - 1
        const refRow = rows[refIdx]
        if (refRow) {
          taxAmount = Math.round(refRow.total * (row.rate / 100) * 100) / 100
          rowAmount = taxAmount
          netAmount = refRow.total
        }
        break
      }
      case "On Item Quantity":
        taxAmount = Math.round(row.rate * totalQty * 100) / 100
        rowAmount = taxAmount
        netAmount = totalQty
        break
    }

    runningTotal = Math.round((runningTotal + rowAmount) * 100) / 100
    return {
      ...row,
      tax_amount: taxAmount,
      net_amount: netAmount,
      total: runningTotal,
      tax_amount_after_discount_amount: rowAmount,
    }
  })
}

/**
 * ERPNext `get_total_for_discount_amount()` parity (taxes_and_totals.py:803-844).
 * The discount is distributed over the pre-discount grand total minus the taxes
 * of type Actual / On Item Quantity and any percentage-of-previous-row taxes
 * that derive from them. `totalTaxesAndChargesBase` is the full pre-discount
 * sum of all tax_amounts.
 */
export function computeTotalForDiscountAmount(
  rows: EditableTaxRow[],
  subtotal: number,
  totalTaxesAndChargesBase: number,
): number {
  let cumulative = 0
  let actualTax = 0
  const actualByIdx = new Map<number, { amount: number; cumulative: number }>()
  rows.forEach((row, i) => {
    const idx = i + 1
    if (row.charge_type === "Actual" || row.charge_type === "On Item Quantity") {
      cumulative += row.tax_amount
      actualTax += row.tax_amount
      actualByIdx.set(idx, { amount: row.tax_amount, cumulative })
    } else if (row.row_id && actualByIdx.has(row.row_id)) {
      const base = actualByIdx.get(row.row_id)!
      const derived =
        (row.charge_type === "On Previous Row Amount"
          ? base.amount
          : base.cumulative) * (row.rate / 100)
      cumulative += derived
      actualTax += derived
      actualByIdx.set(idx, { amount: derived, cumulative })
    }
  })
  return subtotal + totalTaxesAndChargesBase - actualTax
}

/** Create a blank tax row with sensible defaults. */
export function createEmptyTaxRow(): EditableTaxRow {
  return {
    charge_type: "On Net Total",
    account_head: "",
    description: "",
    rate: 0,
    tax_amount: 0,
    net_amount: 0,
    total: 0,
    included_in_print_rate: false,
    row_id: undefined,
  }
}

/**
 * Fetch the Currency master's `smallest_currency_fraction_value`
 * (e.g. 1.0 for CAD in our data, 0.01 for USD). Returns null when the
 * currency has no fraction configured or the fetch fails.
 */
export async function getCurrencySmallestFraction(
  currency: string | undefined,
): Promise<number | null> {
  if (!currency) return null
  try {
    const doc = await apiClient<{ smallest_currency_fraction_value?: number }>(
      `/resource/Currency/${encodeURIComponent(currency)}`,
    )
    const value = doc?.smallest_currency_fraction_value
    return typeof value === "number" && isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

/** Banker's rounding matching frappe.utils.data._bankers_rounding_legacy. */
function bankersRoundingLegacy(num: number, precision: number): number {
  const multiplier = 10 ** precision
  let n = Math.round(num * multiplier * 1e8) / 1e8
  const floor = Math.floor(n)
  const decimalPart = n - floor
  if (precision === 0 && decimalPart === 0.5) {
    n = floor % 2 === 0 ? floor : floor + 1
  } else if (decimalPart === 0.5) {
    n = floor + 1
  } else {
    n = Math.round(n)
  }
  return precision ? n / multiplier : n
}

/**
 * Mirror of frappe.utils.data.round_based_on_smallest_currency_fraction:
 * round `value` to the nearest multiple of the currency's smallest fraction;
 * when no fraction is configured, round to the nearest whole number.
 */
export function roundToSmallestCurrencyFraction(
  value: number,
  fraction: number | null | undefined,
  precision = 2,
): number {
  if (fraction) {
    const multiplier = 10 ** precision
    const scaled = value * multiplier
    const scaledFrac = fraction * multiplier
    const remainderVal = bankersRoundingLegacy(
      ((scaled % scaledFrac) + scaledFrac) % scaledFrac / multiplier,
      precision,
    )
    if (remainderVal > fraction / 2) {
      value += fraction - remainderVal
    } else {
      value -= remainderVal
    }
    return bankersRoundingLegacy(value, precision)
  }
  return bankersRoundingLegacy(value, 0)
}