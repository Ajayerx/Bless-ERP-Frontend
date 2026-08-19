import { apiClient, apiFormCall, apiClientWithBody, serverMessagesFromBody, ApiError } from "@/services/api-client"
import { postMethod, postMethodRaw } from "@/services/frappe-client"
import { API_CONFIG } from "@/config/api.config"
import { buildTimelineItems, toQuillHtml } from "@/modules/payments/services"
import type { DocInfo, PaymentActivityItem, PaymentComment } from "@/modules/payments/types"
import type { Quotation, QuotationTax, QuotationFormData, QuotationListResponse } from "../types"

export type {
  Quotation,
  QuotationItem,
  QuotationTax,
  QuotationFormData,
  QuotationListResponse,
  QuotationStatus,
  QuotationDocStatus,
  QuotationTo,
  PaymentScheduleRow,
  PricingRuleRow,
  LostReasonRow,
  CompetitorRow,
} from "../types"

const DOCTYPE = "Quotation"

/** Fields the quotation list page needs (name/status/party/dates/totals). */
const LIST_FIELDS = [
  "name", "title", "quotation_to", "party_name", "customer_name", "transaction_date",
  "valid_till", "order_type", "company", "currency", "grand_total", "rounded_total",
  "status", "docstatus", "amended_from", "owner", "creation", "modified", "modified_by",
  "_assign", "_user_tags",
]

function buildListUrl(params: {
  fields: string[]
  filters?: unknown[]
  orFilters?: unknown[]
  limit_page_length?: number
  limit_start?: number
  order_by?: string
}): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters && params.filters.length > 0) qp.set("filters", JSON.stringify(params.filters))
  if (params.orFilters && params.orFilters.length > 0) qp.set("or_filters", JSON.stringify(params.orFilters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent(DOCTYPE)}?${qp.toString()}`
}

async function getCount(filters?: unknown[], orFilters?: unknown[]): Promise<number> {
  const qp = new URLSearchParams()
  qp.set("doctype", DOCTYPE)
  if (filters && filters.length > 0) qp.set("filters", JSON.stringify(filters))
  if (orFilters && orFilters.length > 0) qp.set("or_filters", JSON.stringify(orFilters))
  const result = await apiClient<number>(`/method/frappe.client.get_count?${qp.toString()}`)
  return Number(result)
}

/** ERPNext get_party_details default payload for Quotation. */
export interface QuotationPartyDetails {
  customer?: string
  customer_name?: string
  party_name?: string
  customer_group?: string
  territory?: string
  language?: string
  customer_address?: string
  address_display?: string
  shipping_address_name?: string
  shipping_address?: string
  contact_person?: string
  contact_display?: string
  contact_mobile?: string
  contact_email?: string
  company_address?: string
  company_address_display?: string
  currency?: string
  conversion_rate?: number
  selling_price_list?: string
  price_list_currency?: string
  plc_conversion_rate?: number
  tax_category?: string
  taxes_and_charges?: string
  payment_terms_template?: string
}

/** ERPNext get_item_details default payload for a Quotation item row. */
export interface QuotationItemDetails {
  item_code?: string
  item_name?: string
  uom?: string
  stock_uom?: string
  conversion_factor?: number
  price_list_rate?: number
  rate?: number
  amount?: number
  warehouse?: string
  income_account?: string
  cost_center?: string
  description?: string
  stock_qty?: number
  delivery_date?: string
  item_tax_template?: string
  is_free_item?: number
  margin_type?: string
  margin_rate_or_amount?: number
}

export interface EmailTemplateResult {
  subject: string
  message: string
}

export interface GetDocResult {
  doc: Quotation
  docinfo: DocInfo
}

export const quotationService = {
  // ── List / single (used by list page; D4 adds reportview.get + tabs) ──
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
    status?: string
    customerId?: string
    transactionDateFrom?: string
    transactionDateTo?: string
    validTillFrom?: string
    validTillTo?: string
    assignedTo?: string
    sortBy?: string
    sortOrder?: "asc" | "desc"
  }): Promise<QuotationListResponse> {
    const pageSize = params.pageSize ?? 10
    const limit_start = ((params.page ?? 1) - 1) * pageSize
    const filters: unknown[] = []

    if (params.status && params.status !== "all" && params.status !== "All") {
      filters.push(["status", "=", params.status])
    }
    if (params.customerId) filters.push(["party_name", "=", params.customerId])
    if (params.transactionDateFrom) filters.push(["transaction_date", ">=", params.transactionDateFrom])
    if (params.transactionDateTo) filters.push(["transaction_date", "<=", params.transactionDateTo])
    if (params.validTillFrom) filters.push(["valid_till", ">=", params.validTillFrom])
    if (params.validTillTo) filters.push(["valid_till", "<=", params.validTillTo])
    if (params.assignedTo) filters.push(["_assign", "like", `%${params.assignedTo}%`])

    const orFilters: unknown[] = []
    if (params.search) {
      const like = `%${params.search}%`
      orFilters.push(
        ["name", "like", like],
        ["party_name", "like", like],
        ["customer_name", "like", like],
      )
    }

    const order_by = params.sortBy
      ? `${params.sortBy} ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
      : "transaction_date desc"

    const [rows, total] = await Promise.all([
      apiClient<Quotation[]>(
        buildListUrl({
          fields: LIST_FIELDS,
          filters: filters.length > 0 ? filters : undefined,
          orFilters: orFilters.length > 0 ? orFilters : undefined,
          limit_page_length: pageSize,
          limit_start,
          order_by,
        })
      ),
      getCount(filters.length > 0 ? filters : undefined, orFilters.length > 0 ? orFilters : undefined),
    ])

    return {
      items: rows ?? [],
      total,
      page: params.page ?? 1,
      pageSize,
    }
  },

  async getById(name: string): Promise<Quotation> {
    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify([...LIST_FIELDS, "currency", "conversion_rate", "selling_price_list", "price_list_currency", "plc_conversion_rate", "taxes", "items"]))
    return apiClient<Quotation>(`/resource/${DOCTYPE}/${encodeURIComponent(name)}?${qp.toString()}`)
  },

  // ── Form open (lean single-fetch) ─────────────────────────────────
  // Loads the full document (incl. child tables) via a plain resource GET.
  // This replaces the old frappe.desk.form.load.getdoc call, whose response
  // bundled the entire docinfo (comments/versions/user_info/_link_titles) and
  // could keep the initial page skeleton alive while that large body streams.
  // Activity/assignments are fetched separately and only where displayed.
  async getDoc(name: string): Promise<GetDocResult> {
    const doc = await apiClient<Quotation>(
      `/resource/${DOCTYPE}/${encodeURIComponent(name)}`,
    )
    return {
      doc,
      docinfo: { comments: [], versions: [] },
    }
  },

  // frappe.desk.form.save.savedocs ({ doc, action: Save|Update|Submit }).
  async saveDoc(doc: Record<string, unknown>, action: "Save" | "Update" | "Submit"): Promise<Quotation> {
    const body = await postMethodRaw<{ message?: string; docs?: Quotation[] }>(
      "frappe.desk.form.save.savedocs",
      { doc: JSON.stringify(doc), action },
    )
    return body.docs?.[0] as Quotation
  },

  // Convenience wrappers so D3/D4 consumers can keep create/update/delete verbs.
  async create(data: QuotationFormData): Promise<Quotation> {
    return this.saveDoc({ ...data, doctype: DOCTYPE }, "Save")
  },

  async update(name: string, data: QuotationFormData): Promise<Quotation> {
    return this.saveDoc({ ...data, doctype: DOCTYPE, name }, "Save")
  },

  // frappe.desk.form.save.cancel
  async cancelDoc(name: string): Promise<void> {
    const body = await postMethodRaw<{ message?: unknown }>("frappe.desk.form.save.cancel", {
      doctype: DOCTYPE,
      name,
    })
    const messages = serverMessagesFromBody(body)
    if (messages.length > 0) {
      throw new ApiError(0, messages.map((m) => m.message).join(" "), undefined, messages[0])
    }
  },

  async cancel(name: string): Promise<void> {
    await this.cancelDoc(name)
  },

  // Amend = client-side clone (amended_from, docstatus 0) re-saved as new.
  async amend(source: Quotation): Promise<Quotation> {
    const managedFields = new Set([
      "name", "creation", "modified", "modified_by", "owner",
      "docstatus", "_comments", "_assign", "_liked_by",
    ])
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(source)) {
      if (managedFields.has(k)) continue
      if (Array.isArray(v)) {
        cleaned[k] = v.map((row: Record<string, unknown>) => {
          if (row && typeof row === "object") {
            const { name: _n, parent: _p, parentfield: _pf, parenttype: _pt, creation: _c, modified: _m, owner: _o, idx: _i, ...rest } = row as Record<string, unknown>
            return rest
          }
          return row
        })
      } else {
        cleaned[k] = v
      }
    }
    cleaned.doctype = DOCTYPE
    cleaned.amended_from = source.name
    cleaned.docstatus = 0
    return this.saveDoc(cleaned, "Save")
  },

  async delete(name: string): Promise<void> {
    return apiClient<void>(`/resource/${DOCTYPE}/${encodeURIComponent(name)}`, { method: "DELETE" })
  },

  // ── Docinfo / activity timeline ────────────────────────────────────
  async getDocInfo(name: string): Promise<DocInfo> {
    const body = await apiClientWithBody<{ docinfo?: DocInfo }>(
      `/method/frappe.desk.form.load.get_docinfo?doctype=${encodeURIComponent(DOCTYPE)}&name=${encodeURIComponent(name)}`,
    )
    return body.docinfo ?? { comments: [], versions: [] }
  },

  async getActivity(doc: Quotation, currentUserId?: string): Promise<PaymentActivityItem[]> {
    const docinfo = await this.getDocInfo(doc.name)
    return buildTimelineItems(doc, docinfo, currentUserId)
  },

  // ── Comments ───────────────────────────────────────────────────────
  async addComment(name: string, content: string, commentEmail: string, commentBy: string): Promise<PaymentComment> {
    const row = await postMethod<{ name: string; content: string; owner: string; creation: string }>(
      "frappe.desk.form.utils.add_comment",
      {
        reference_doctype: DOCTYPE,
        reference_name: name,
        content: toQuillHtml(content),
        comment_email: commentEmail,
        comment_by: commentBy,
      },
    )
    return { id: row.name, content: row.content, author: row.owner, createdAt: row.creation }
  },

  async updateComment(name: string, content: string): Promise<{ name: string }> {
    return postMethod<{ name: string }>("frappe.desk.form.utils.update_comment", {
      name,
      content: toQuillHtml(content),
    })
  },

  async deleteComment(name: string): Promise<{ message: string }> {
    return postMethod<{ message: string }>("frappe.client.delete", { doctype: "Comment", name })
  },

  // ── Assignment ─────────────────────────────────────────────────────
  async assignTo(names: string[], user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.add_multiple", {
      assign_to: JSON.stringify([user]),
      doctype: DOCTYPE,
      name: JSON.stringify(names),
    })
  },

  async removeAssignment(names: string[]): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.remove_multiple", {
      doctype: DOCTYPE,
      names: JSON.stringify(names),
    })
  },

  async assignUserToDoc(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.add", {
      assign_to: JSON.stringify([user]),
      doctype: DOCTYPE,
      name,
    })
  },

  async unassignUserFromDoc(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.remove", {
      doctype: DOCTYPE,
      name,
      assign_to: user,
    })
  },

  async completeOwnAssignment(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.close", {
      doctype: DOCTYPE,
      name,
      assign_to: user,
    })
  },

  // ── Tags ───────────────────────────────────────────────────────────
  async addTags(names: string[], tags: string | string[], color = ""): Promise<void> {
    const tagLabels = Array.isArray(tags) ? tags : [tags]
    await postMethod("frappe.desk.doctype.tag.tag.add_tags", {
      tags: JSON.stringify(tagLabels),
      dt: DOCTYPE,
      docs: JSON.stringify(names),
      color,
    })
  },

  async addTagToDoc(name: string, tag: string): Promise<void> {
    await postMethod("frappe.desk.doctype.tag.tag.add_tag", {
      tag,
      dt: DOCTYPE,
      dn: name,
    })
  },

  async removeTagFromDoc(name: string, tag: string): Promise<void> {
    await postMethod("frappe.desk.doctype.tag.tag.remove_tag", {
      tag,
      dt: DOCTYPE,
      dn: name,
    })
  },

  async searchTags(query: string): Promise<string[]> {
    try {
      return (await postMethod<string[] | null>("frappe.desk.doctype.tag.tag.get_tags", {
        doctype: DOCTYPE,
        txt: query,
      })) ?? []
    } catch {
      return []
    }
  },

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
        }).toString()
    )
    return (results ?? []).map((u) => ({
      value: u.value,
      label: u.label ?? u.value,
      description: u.description ?? "",
    }))
  },

  // ── Conversion chain (Create menu) ─────────────────────────────────
  async makeSalesOrder(sourceName: string, selectedItems?: Array<{ item_code: string; qty: number }>): Promise<{ doctype: string; name: string }> {
    const promise = apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.quotation.quotation.make_sales_order", source_name: sourceName }) },
    )
    if (selectedItems && selectedItems.length > 0) {
      return promise.then((res) => res)
    }
    return promise
  },

  async makeSalesInvoice(sourceName: string): Promise<{ doctype: string; name: string }> {
    return apiClient<{ doctype: string; name: string }>(
      "/method/frappe.model.mapper.make_mapped_doc",
      { method: "POST", body: JSON.stringify({ method: "erpnext.selling.doctype.quotation.quotation.make_sales_invoice", source_name: sourceName }) },
    )
  },

  // ── Set as Lost ────────────────────────────────────────────────────
  async declareLost(
    sourceName: string,
    opts: { lostReasons: string[]; competitors: string[]; detailedReason?: string },
  ): Promise<void> {
    await postMethod("erpnext.selling.doctype.quotation.quotation.declare_enquiry_lost", {
      source_name: sourceName,
      lost_reasons_list: JSON.stringify(opts.lostReasons),
      competitors: JSON.stringify(opts.competitors),
      detailed_reason: opts.detailedReason ?? "",
    })
  },

  // ── Fetch flows (form field fills) ─────────────────────────────────
  async getExchangeRate(fromCurrency: string, toCurrency: string, transactionDate: string): Promise<number> {
    const rate = await apiFormCall<number | string>(
      "/method/erpnext.setup.utils.get_exchange_rate",
      [
        ["from_currency", fromCurrency],
        ["to_currency", toCurrency],
        ["transaction_date", transactionDate],
        ["args", '"for_selling"'],
      ],
    )
    return Number(rate) || 0
  },

  async getPartyDetails(
    partyType: string,
    party: string,
    company: string,
    transactionDate: string,
    opts?: { priceList?: string; currency?: string; fetchPaymentTermsTemplate?: boolean },
  ): Promise<QuotationPartyDetails> {
    const fields: Array<[string, string]> = [
      ["transaction_date", transactionDate],
      ["party_type", partyType],
      ["party", party],
      ["company", company],
      ["doctype", DOCTYPE],
    ]
    if (opts?.priceList) fields.push(["price_list", opts.priceList])
    fields.push(["fetch_payment_terms_template", opts?.fetchPaymentTermsTemplate === false ? "0" : "1"])
    if (opts?.currency) fields.push(["currency", opts.currency])
    return apiFormCall<QuotationPartyDetails>("/method/erpnext.accounts.party.get_party_details", fields)
  },

  async getItemDetails(args: Record<string, unknown>, company: string): Promise<QuotationItemDetails> {
    return apiFormCall<QuotationItemDetails>(
      "/method/erpnext.stock.get_item_details.get_item_details",
      [
        ["args", JSON.stringify({ ...args, doctype: DOCTYPE, company })],
        ["doctype", DOCTYPE],
      ],
      { doctype: DOCTYPE },
    )
  },

  async getTaxesAndCharges(masterName: string): Promise<{ tax_category?: string; taxes?: QuotationTax[] }> {
    const result = await apiFormCall<{ tax_category?: string; taxes?: QuotationTax[] }>(
      "/method/erpnext.controllers.accounts_controller.get_taxes_and_charges",
      [
        ["master_doctype", "Sales Taxes and Charges Template"],
        ["master_name", masterName],
      ],
    )
    return result ?? {}
  },

  // Mirrors erpnext.get_payment_terms → { payment_schedule }.
  async getPaymentTerms(
    template: string,
    postingDate: string,
    grandTotal: number,
  ): Promise<{ payment_schedule: Array<Record<string, unknown>> }> {
    const result = await apiFormCall<{ payment_schedule?: Array<Record<string, unknown>> }>(
      "/method/erpnext.controllers.accounts_controller.get_payment_terms",
      [
        ["terms_template", template],
        ["posting_date", postingDate],
        ["grand_total", String(grandTotal)],
      ],
    )
    return { payment_schedule: result?.payment_schedule ?? [] }
  },

  // Mirrors erpnext.utils.get_terms: renders Terms and Conditions template text.
  async getTerms(templateName: string, doc: Record<string, unknown>): Promise<string | null> {
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

  // ── Email / print ──────────────────────────────────────────────────
  async getPrintFormats(): Promise<string[]> {
    try {
      const raw = await apiClient<Array<{ name: string }>>(
        `/resource/Print Format?filters=${JSON.stringify([["doc_type", "=", DOCTYPE], ["disabled", "=", 0]])}&fields=["name"]&limit_page_length=100`
      )
      return raw.map((f) => f.name)
    } catch {
      return ["Standard"]
    }
  },

  async getEmailTemplate(templateName: string, doc: Record<string, unknown>): Promise<EmailTemplateResult | null> {
    try {
      const result = await postMethod<EmailTemplateResult>("frappe.email.doctype.email_template.email_template.get_email_template", {
        template_name: templateName,
        doc: JSON.stringify(doc),
      })
      return result
    } catch {
      return null
    }
  },

  async generatePDF(name: string, options?: {
    printFormat?: string
    letterHead?: string
    noLetterhead?: boolean
    language?: string
  }): Promise<Blob> {
    const params = new URLSearchParams()
    params.set("doctype", DOCTYPE)
    params.set("name", name)
    if (options?.printFormat) params.set("format", options.printFormat)
    if (options?.letterHead) params.set("letterhead", options.letterHead)
    if (options?.noLetterhead) params.set("no_letterhead", "1")
    if (options?.language) params.set("_lang", options.language)

    const res = await fetch(`${API_CONFIG.baseUrl}/method/frappe.utils.print_format.download_pdf?${params.toString()}`, {
      credentials: "include",
      headers: API_CONFIG.headers,
    })
    if (!res.ok) throw new Error("Failed to generate PDF")
    return res.blob()
  },

  async sendEmail(name: string, data: {
    recipients: string
    cc?: string
    subject: string
    content: string
    printFormat?: string
    attachPdf?: boolean
    sendHtml?: boolean
  }): Promise<{ name: string }> {
    return apiClient<{ name: string }>("/method/frappe.core.doctype.communication.email.make", {
      method: "POST",
      body: JSON.stringify({
        doctype: DOCTYPE,
        name,
        recipients: data.recipients,
        cc: data.cc ?? "",
        subject: data.subject,
        content: data.content,
        communication_medium: "Email",
        send_email: 1,
        send_after_commit: 1,
        print_format: data.printFormat || "Standard",
        ...(data.attachPdf ? { attach_document_print: JSON.stringify({ doctype: DOCTYPE, name }) } : {}),
      }),
    })
  },
}