import { http, HttpResponse, delay } from "msw"
import { initialEmailTemplates as seedTemplates } from "../data/email-templates"

export interface EmailTemplateRow {
  name: string
  template_name: string
  subject: string
  response: string
  use_html: number
  enabled: number
  creation: string
  modified: string
}

function stamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19)
}

let store: EmailTemplateRow[] = seedTemplates.map((t) => ({ ...t }))

export function resetEmailTemplates(): void {
  store = seedTemplates.map((t) => ({ ...t }))
}

function matches(row: EmailTemplateRow, filter: unknown[]): boolean {
  const [field, op, expected] = filter as [string, string, unknown]
  const actual = row[field as keyof EmailTemplateRow]
  switch (op) {
    case "=":
      return String(actual ?? "") === String(expected ?? "")
    case "!=":
      return String(actual ?? "") !== String(expected ?? "")
    case "like":
      return String(actual ?? "").toLowerCase().includes(
        String(expected ?? "").replace(/%/g, "").toLowerCase(),
      )
    case "in":
      return Array.isArray(expected) && expected.map(String).includes(String(actual ?? ""))
    default:
      return true
  }
}

function filtered(rawFilters: unknown): EmailTemplateRow[] {
  if (!Array.isArray(rawFilters) || rawFilters.length === 0) return store
  const filters = rawFilters.filter((f): f is unknown[] => Array.isArray(f))
  return store.filter((row) => filters.every((f) => matches(row, f)))
}

function renderedText(text: string, doc: Record<string, unknown>): string {
  return Object.entries(doc).reduce(
    (result, [key, value]) =>
      result
        .replaceAll(`{{doc.${key}}}`, String(value ?? ""))
        .replaceAll(`{{ ${key} }}`, String(value ?? "")),
    text,
  )
}

export const emailTemplateHandlers = [
  http.get("*/resource/Email%20Template", async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    let filters: unknown[] = []
    try {
      filters = JSON.parse(url.searchParams.get("filters") ?? "[]")
    } catch {
      filters = []
    }
    let rows = filtered(filters)
    const orderBy = (url.searchParams.get("order_by") ?? "").trim()
    if (orderBy) {
      const [field, dir] = orderBy.split(/\s+/)
      const mult = (dir ?? "desc").toLowerCase() === "asc" ? 1 : -1
      rows = [...rows].sort(
        (a, b) =>
          String(a[field as keyof EmailTemplateRow] ?? "").localeCompare(
            String(b[field as keyof EmailTemplateRow] ?? ""),
          ) * mult,
      )
    }
    const limit = Number(url.searchParams.get("limit_page_length") ?? 20)
    const start = Number(url.searchParams.get("limit_start") ?? 0)
    const page = limit === 0 ? rows : rows.slice(start, start + limit)
    return HttpResponse.json({ data: page })
  }),

  http.get("*/resource/Email%20Template/:name", async ({ params }) => {
    await delay(80)
    const name = decodeURIComponent(String(params.name))
    const row = store.find((t) => t.name === name)
    if (!row) {
      return HttpResponse.json({ message: `Email Template ${name} not found` }, { status: 404 })
    }
    return HttpResponse.json({ data: { ...row, doctype: "Email Template" } })
  }),

  http.post("*/resource/Email%20Template", async ({ request }) => {
    await delay(120)
    const payload = (await request.json()) as Record<string, unknown>
    const templateName = String(payload.template_name ?? "").trim()
    const now = stamp()
    const row: EmailTemplateRow = {
      name: templateName,
      template_name: templateName,
      subject: String(payload.subject ?? ""),
      response: String(payload.response ?? ""),
      use_html: Number(payload.use_html ?? 0),
      enabled: Number(payload.enabled ?? 1),
      creation: now,
      modified: now,
    }
    store = [row, ...store.filter((t) => t.name !== row.name)]
    return HttpResponse.json({ data: row })
  }),

  http.put("*/resource/Email%20Template/:name", async ({ params, request }) => {
    await delay(120)
    const name = decodeURIComponent(String(params.name))
    const idx = store.findIndex((t) => t.name === name)
    if (idx === -1) {
      return HttpResponse.json({ message: `Email Template ${name} not found` }, { status: 404 })
    }
    const payload = (await request.json()) as Record<string, unknown>
    store[idx] = {
      ...store[idx],
      template_name: String(payload.template_name ?? store[idx].template_name),
      subject: String(payload.subject ?? store[idx].subject),
      response: String(payload.response ?? store[idx].response),
      use_html: Number(payload.use_html ?? store[idx].use_html),
      enabled: Number(payload.enabled ?? store[idx].enabled),
      modified: stamp(),
    }
    return HttpResponse.json({ data: store[idx] })
  }),

  http.delete("*/resource/Email%20Template/:name", async ({ params }) => {
    await delay(80)
    const name = decodeURIComponent(String(params.name))
    store = store.filter((t) => t.name !== name)
    return HttpResponse.json({ data: null })
  }),

  // `getDocCount()` issues a GET with `doctype`/`filters` in the query string.
  http.get("*/method/frappe.client.get_count", async ({ request }) => {
    const url = new URL(request.url)
    if (url.searchParams.get("doctype") !== "Email Template") return HttpResponse.json({ message: 0 })
    let filters: unknown[] = []
    try {
      filters = JSON.parse(url.searchParams.get("filters") ?? "[]")
    } catch {
      filters = []
    }
    return HttpResponse.json({ message: filtered(filters).length })
  }),

  http.post(
    "/api/method/frappe.email.doctype.email_template.email_template.get_email_template",
    async ({ request }) => {
      await delay(120)
      const contentType = request.headers.get("content-type") ?? ""
      let templateName = ""
      let doc: Record<string, unknown> = {}
      if (contentType.includes("application/json")) {
        const body = (await request.json()) as Record<string, unknown>
        templateName = String(body.template_name ?? "")
        try {
          doc = typeof body.doc === "string" ? JSON.parse(body.doc) : ((body.doc as Record<string, unknown>) ?? {})
        } catch {
          doc = {}
        }
      } else {
        const form = await request.formData()
        templateName = String(form.get("template_name") ?? "")
        try {
          doc = JSON.parse(String(form.get("doc") ?? "{}"))
        } catch {
          doc = {}
        }
      }
      const row = store.find((t) => t.name === templateName)
      if (!row) {
        return HttpResponse.json(
          { message: `Email Template ${templateName} not found` },
          { status: 404 },
        )
      }
      return HttpResponse.json({
        message: {
          subject: renderedText(row.subject, doc),
          message: renderedText(row.response, doc),
        },
      })
    },
  ),
]