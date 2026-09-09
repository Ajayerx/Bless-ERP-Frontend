import { http, HttpResponse, delay } from "msw"
import { salesOrders } from "./frappe-lookups"

// ── Sales Order list bulk actions mock backend ───────────────────────
// Mirrors the wire contracts the Sales Order list page uses:
//   frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs
//   frappe.desk.reportview.delete_items
//   erpnext.selling.doctype.sales_order.sales_order.close_or_unclose_sales_orders
//   frappe.core.doctype.data_import.data_import.download_template
// Mutations are applied to the shared frappe-lookups `salesOrders` array so a
// subsequent list refetch reflects them. Non-Sales Order doctypes fall back to
// the generic success shapes the payments handlers would have returned, so this
// can safely shadow them in the registration order.

function rows(): Record<string, unknown>[] {
  return salesOrders as unknown as Record<string, unknown>[]
}

function parseForm(request: Request): Promise<Record<string, string>> {
  return request.formData().catch(() => new FormData()).then((fd) => {
    const out: Record<string, string> = {}
    fd.forEach((value, key) => { out[key] = String(value) })
    return out
  })
}

function safeJson<T>(val: string | undefined, fallback: T): T {
  if (val === undefined || val === "") return fallback
  try { return JSON.parse(val) } catch { return fallback }
}

const nowStamp = () => new Date().toISOString().replace("T", " ").slice(0, 19)

export const salesOrderListHandlers = [
  // ── Bulk submit / cancel via bulk_update ───────────────────────────
  http.post("/api/method/frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", async ({ request }) => {
    await delay(200)
    const body = await parseForm(request)
    if (body.doctype !== "Sales Order") return HttpResponse.json({ message: [] })
    const names = safeJson(body.docnames ?? "[]", []) as string[]
    const action = body.action ?? "submit"
    const failed: string[] = []
    const all = rows()
    for (const name of names) {
      const idx = all.findIndex((s) => String(s.name) === name)
      if (idx === -1) { failed.push(name); continue }
      const row = all[idx]
      if (action === "submit") {
        if (Number(row.docstatus) === 1) continue
        all[idx] = { ...row, docstatus: 1, status: "To Deliver and Bill", modified: nowStamp() }
      } else if (action === "cancel") {
        if (Number(row.docstatus) === 2) continue
        all[idx] = { ...row, docstatus: 2, status: "Cancelled", modified: nowStamp() }
      }
    }
    if (failed.length > 0) {
      return HttpResponse.json({ message: failed })
    }
    return HttpResponse.json({ message: null })
  }),

  // ── Bulk delete via reportview.delete_items ──────────────────────
  http.post("/api/method/frappe.desk.reportview.delete_items", async ({ request }) => {
    await delay(200)
    const body = await parseForm(request)
    if (body.doctype !== "Sales Order") return HttpResponse.json({ message: null })
    const items = safeJson(body.items ?? "[]", []) as string[]
    const all = rows()
    const failed = items.filter((name) => !all.some((s) => String(s.name) === name))
    for (let i = all.length - 1; i >= 0; i--) {
      if (items.includes(String(all[i].name))) all.splice(i, 1)
    }
    if (failed.length > 0) {
      return HttpResponse.json({ message: { undeleted_items: failed } })
    }
    return HttpResponse.json({ message: null })
  }),

  // ── Bulk close via close_or_unclose_sales_orders ──────────────────
  http.post("/api/method/erpnext.selling.doctype.sales_order.sales_order.close_or_unclose_sales_orders", async ({ request }) => {
    await delay(200)
    const body = await parseForm(request)
    const names = safeJson(body.names ?? "[]", []) as string[]
    const status = (body.status ?? "Closed") as "Closed" | "Draft"
    const all = rows()
    for (const name of names) {
      const idx = all.findIndex((s) => String(s.name) === name)
      if (idx === -1) continue
      const row = all[idx]
      // ERPNext gates close to submitted, non-cancelled docs (sales_order.py
      // close_or_unclose_sales_orders only flips docstatus 1 rows).
      if (Number(row.docstatus) === 1 && String(row.status) !== "Cancelled") {
        all[idx] = { ...row, status: status === "Closed" ? "Closed" : "Draft", modified: nowStamp() }
      }
    }
    return HttpResponse.json({ message: status })
  }),

  // ── Export via data_import.download_template ─────────────────────
  http.post("/api/method/frappe.core.doctype.data_import.data_import.download_template", async ({ request }) => {
    await delay(300)
    const body = await parseForm(request)
    const doctype = String(body.doctype ?? "Sales Order")
    const fields = safeJson(body.export_fields ?? "{}", {}) as Record<string, string[]>
    const parentFields = (fields[doctype] ?? (fields["Sales Order"] ?? ["name"])) as string[]
    const header = parentFields.join(",")
    const csv = `${header}\r\n${parentFields.map(() => "value").join(",")}\r\n`
    return new HttpResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    })
  }),
]