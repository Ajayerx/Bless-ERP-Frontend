import { http, HttpResponse, delay } from "msw"
import {
  salesOrders,
  quotations,
  quotationItems,
  withItemNames,
} from "./frappe-lookups"

function formBody(body: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of new URLSearchParams(body)) {
    out[key] = value
  }
  return out
}

function parseJsonArg<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

// ── Get Items From parent search: frappe.desk.search.search_widget ───
// Backs the "Get Items From" modal's parent list. Rows mount as plain text in
// the modal, so an array of source docs (name + setter columns) is sufficient.
function searchWidget(doc: { doctype?: string; body: Record<string, unknown> }): Array<Record<string, unknown>> {
  let rows: Array<Record<string, unknown>>
  if (doc.doctype === "Quotation") rows = quotations.map((q) => ({ ...q }))
  else if (doc.doctype === "Sales Order") rows = salesOrders.map((s) => ({ ...s }))
  else return []
  const filters = parseJsonArg<Record<string, unknown>>(doc.body.filters, {})
  const start = Number(doc.body.start ?? 0)
  const pageLength = Number(doc.body.page_length ?? 10)
  for (const [field, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue
    if (Array.isArray(value)) {
      const op = String(value[0] ?? "=")
      const val = value.length > 1 ? value[1] : undefined
      if (op === "!=") rows = rows.filter((r) => String(r[field] ?? "") !== String(val))
      else if (op === "in") rows = rows.filter((r) => Array.isArray(val) && val.includes(r[field]))
    } else {
      const needle = String(value)
      const like = needle.includes("%")
      rows = rows.filter((r) =>
        like
          ? String(r[field] ?? "").toLowerCase().includes(needle.replace(/%/g, "").toLowerCase())
          : String(r[field] ?? "") === needle,
      )
    }
  }
  const txt = String(doc.body.txt ?? "").trim().toLowerCase()
  if (txt) {
    rows = rows.filter((r) =>
      Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(txt)),
    )
  }
  return rows.slice(start, start + pageLength)
}

// ── Get Items From child rows: frappe.client.get_list ────────────────
function getList(doc: { doctype?: string; body: Record<string, unknown> }): Array<Record<string, unknown>> {
  let rows: Array<Record<string, unknown>>
  if (doc.doctype === "Quotation Item") {
    rows = quotations.flatMap((q) =>
      quotationItems.map((i, ii) => ({
        ...i,
        doctype: "Quotation Item",
        parentfield: "items",
        parenttype: "Quotation",
        parent: q.name,
        name: `${q.name}-ITEM-${ii + 1}`,
        idx: ii + 1,
        qty: 1,
      })),
    )
  } else if (doc.doctype === "Sales Order Item") {
    rows = salesOrders.flatMap((s) => {
      const sRow = s as unknown as Record<string, unknown>
      const items = Array.isArray(sRow.items)
        ? (sRow.items as Array<Record<string, unknown>>)
        : withItemNames(String(sRow.name))
      return items.map((i, ii) => ({
        ...i,
        doctype: "Sales Order Item",
        parentfield: "items",
        parenttype: "Sales Order",
        parent: String(sRow.name),
        name: String(i.name ?? `${sRow.name}-ITEM-${ii + 1}`),
        idx: ii + 1,
      }))
    })
  } else {
    return []
  }
  const filters = parseJsonArg<unknown[]>(doc.body.filters, [])
  for (const cond of filters) {
    if (!Array.isArray(cond) || cond.length < 3) continue
    const [field, op, value] = cond as [string, string, unknown]
    if (op === "=") rows = rows.filter((r) => String(r[field] ?? "") === String(value))
    else if (op === "!=") rows = rows.filter((r) => String(r[field] ?? "") !== String(value))
    else if (op === "in") rows = rows.filter((r) => Array.isArray(value) && value.includes(r[field]))
  }
  const limitStart = Number(doc.body.limit_start ?? 0)
  const limitPageLength = Number(doc.body.limit_page_length ?? 20)
  return rows.slice(limitStart, limitStart + limitPageLength)
}

// ── Get Items From mapping: frappe.model.mapper.map_docs ─────────────
function mapDocs(doc: {
  method?: string
  sourceNames?: string[]
  targetDoc?: Record<string, unknown>
}): Record<string, unknown> {
  const method = String(doc.method ?? "")
  const sourceNames = doc.sourceNames ?? []
  const targetDoc = doc.targetDoc ?? {}
  const items: Array<Record<string, unknown>> = []
  if (method.includes("quotation")) {
    for (const src of sourceNames) {
      const q = quotations.find((row) => row.name === src)
      if (!q) continue
      quotationItems.forEach((i, ii) => {
        items.push({
          ...i,
          doctype: "Sales Order Item",
          parentfield: "items",
          parenttype: "Sales Order",
          name: `${q.name}-ITEM-${ii + 1}`,
          idx: ii + 1,
          qty: 1,
        })
      })
    }
  }
  if (method.includes("sales_order")) {
    for (const src of sourceNames) {
      const s = salesOrders.find((row) => row.name === src) as unknown as Record<string, unknown> | undefined
      if (!s) continue
      const srcItems = Array.isArray(s.items)
        ? (s.items as Array<Record<string, unknown>>)
        : withItemNames(String(s.name))
      srcItems.forEach((i) => {
        items.push({ ...i, doctype: "Sales Invoice Item", parentfield: "items", parenttype: "Sales Invoice" })
      })
    }
  }
  return { ...targetDoc, items }
}

export const getItemsHandlers = [
  http.post("/api/method/frappe.desk.search.search_widget", async ({ request }) => {
    await delay(120)
    const body = formBody(await request.text())
    const doctype = String(body.doctype ?? "")
    const rows = searchWidget({ doctype, body })
    return HttpResponse.json({ message: rows })
  }),

  http.post("/api/method/frappe.client.get_list", async ({ request }) => {
    await delay(120)
    const body = formBody(await request.text())
    const doctype = String(body.doctype ?? "")
    const rows = getList({ doctype, body })
    return HttpResponse.json({ message: rows })
  }),

  http.post("/api/method/frappe.model.mapper.map_docs", async ({ request }) => {
    await delay(150)
    const body = formBody(await request.text())
    const mapped = mapDocs({
      method: String(body.method ?? ""),
      sourceNames: parseJsonArg<string[]>(body.source_names, []),
      targetDoc: parseJsonArg<Record<string, unknown>>(body.target_doc, {}),
    })
    return HttpResponse.json({ message: mapped })
  }),
]