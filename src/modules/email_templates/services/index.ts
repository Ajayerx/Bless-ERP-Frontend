import { apiClient } from "@/services/api-client"
import { postMethod, getDocCount } from "@/services/frappe-client"
import type {
  EmailTemplate,
  EmailTemplateFormData,
  EmailTemplateListFilters,
  EmailTemplateListResponse,
  EmailTemplateRender,
} from "../types"

export type {
  EmailTemplate,
  EmailTemplateFormData,
  EmailTemplateListFilters,
  EmailTemplateListResponse,
  EmailTemplateRender,
} from "../types"

export const EMAIL_TEMPLATE_LIST_FIELDS = [
  "name",
  "template_name",
  "subject",
  "use_html",
  "enabled",
  "creation",
  "modified",
  "modified_by",
  "owner",
]

export function buildEmailTemplateListUrl(params: {
  fields?: string[]
  filters?: unknown[]
  limit_page_length?: number
  limit_start?: number
  order_by?: string
} = {}): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields ?? EMAIL_TEMPLATE_LIST_FIELDS))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start != null) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent("Email Template")}?${qp.toString()}`
}

function toFormDoc(data: EmailTemplateFormData): Record<string, unknown> {
  return {
    template_name: data.template_name.trim(),
    subject: data.subject?.trim() ?? "",
    response: data.response ?? "",
    use_html: data.use_html ? 1 : 0,
    enabled: data.enabled === undefined ? 1 : data.enabled ? 1 : 0,
  }
}

export const emailTemplateService = {
  async list(params: EmailTemplateListFilters = {}): Promise<EmailTemplateListResponse> {
    const pageSize = params.pageSize ?? 20
    const limitStart = (params.page ?? 1) * pageSize - pageSize
    const searchFilters = params.search
      ? [["template_name", "like", `%${params.search}%`]]
      : []
    const statusFilters: unknown[][] = []
    if (params.status === "enabled") statusFilters.push(["enabled", "=", 1])
    if (params.status === "disabled") statusFilters.push(["enabled", "=", 0])
    const filters = [...searchFilters, ...statusFilters]
    const orderBy = params.orderBy
      ? `${params.orderBy} ${params.order === "desc" ? "DESC" : "ASC"}`
      : "modified DESC"

    const [rows, total] = await Promise.all([
      apiClient<EmailTemplate[]>(
        buildEmailTemplateListUrl({
          filters: filters.length > 0 ? filters : undefined,
          limit_start: limitStart,
          limit_page_length: pageSize,
          order_by: orderBy,
        }),
      ),
      getDocCount("Email Template", filters.length > 0 ? filters : undefined),
    ])

    return {
      items: rows,
      total,
      page: params.page ?? 1,
      pageSize,
      // `pageSize: 0` means "no server-side paging"; report a single page
      // instead of dividing by zero.
      totalPages: pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    }
  },

  /** Every enabled template name, for the send-email picker. */
  async names(): Promise<string[]> {
    try {
      const rows = await apiClient<Array<{ name: string }>>(
        buildEmailTemplateListUrl({
          fields: ["name"],
          filters: [["enabled", "=", 1]],
          order_by: "template_name asc",
          limit_page_length: 0,
        }),
      )
      return rows.map((r) => r.name)
    } catch {
      return []
    }
  },

  async getById(name: string): Promise<EmailTemplate> {
    return apiClient<EmailTemplate>(`/resource/Email%20Template/${encodeURIComponent(name)}`)
  },

  async create(data: EmailTemplateFormData): Promise<EmailTemplate> {
    return apiClient<EmailTemplate>("/resource/Email%20Template", {
      method: "POST",
      body: JSON.stringify(toFormDoc(data)),
    })
  },

  async update(name: string, data: EmailTemplateFormData): Promise<EmailTemplate> {
    return apiClient<EmailTemplate>(`/resource/Email%20Template/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify(toFormDoc(data)),
    })
  },

  async delete(name: string): Promise<void> {
    await apiClient(`/resource/Email%20Template/${encodeURIComponent(name)}`, { method: "DELETE" })
  },

  /**
   * Renders a template against a document. Frappe answers
   * `{ subject, message }`, adding `message_html` when Use HTML is ticked.
   */
  async render(templateName: string, doc: Record<string, unknown>): Promise<EmailTemplateRender | null> {
    try {
      // Frappe answers `{ subject, message }` and adds `message_html` when the
      // template has Use HTML ticked.
      const result = await postMethod<{
        subject?: string
        message?: string
        message_html?: string
      }>("frappe.email.doctype.email_template.email_template.get_email_template", {
        template_name: templateName,
        doc: JSON.stringify(doc),
      })
      if (!result) return null
      return {
        subject: result.subject ?? "",
        message: result.message ?? result.message_html ?? "",
      }
    } catch {
      return null
    }
  },
}