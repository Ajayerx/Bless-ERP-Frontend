export interface EmailTemplate {
  name: string
  template_name: string
  /** ERPNext `subject` field (0 for a plain body-only template). */
  subject?: string
  /** ERPNext `response`/`message` body. Server sends `response_html` when Use HTML is on. */
  response?: string
  response_html?: string
  use_html: 0 | 1
  enabled: 0 | 1
  creation?: string
  modified?: string
  modified_by?: string
  owner?: string
}

export interface EmailTemplateListFilters {
  search?: string
  page?: number
  pageSize?: number
  status?: "enabled" | "disabled"
  orderBy?: string
  order?: "asc" | "desc"
}

export interface EmailTemplateListResponse {
  items: EmailTemplate[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface EmailTemplateFormData {
  name?: string
  template_name: string
  subject?: string
  response?: string
  use_html?: 0 | 1
  enabled?: 0 | 1
}

/** Result of `frappe.email.doctype.email_template.email_template.get_email_template`. */
export interface EmailTemplateRender {
  subject: string
  message: string
}