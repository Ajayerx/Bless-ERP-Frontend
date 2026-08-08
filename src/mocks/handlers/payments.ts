import { http, HttpResponse, delay } from "msw"
import paymentsData from "../data/payments.json"
import invoicesData from "../data/invoices.json"

let payments = [...paymentsData]
let invoices = [...invoicesData]

export const paymentHandlers = [
  http.get("/api/payments", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    payments.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    const total = payments.length
    const start = (page - 1) * pageSize
    const paged = payments.slice(start, start + pageSize)

    return HttpResponse.json({
      data: {
        items: paged,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      error: null,
    })
  }),

  http.get("*/payments/:id", async ({ params }) => {
    await delay(200)
    const payment = payments.find((p) => p.id === params.id)
    if (!payment) return HttpResponse.json({ data: null, error: { message: "Payment not found" } }, { status: 404 })
    return HttpResponse.json({ data: payment, error: null })
  }),

  http.get("/api/invoices/unpaid", async () => {
    await delay(300)
    const unpaid = invoices.filter(
      (inv) => inv.status === "sent" || inv.status === "overdue"
    )
    return HttpResponse.json({ data: unpaid, error: null })
  }),

  http.post("/api/payments", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>

    const count = payments.length
    const newPayment = {
      id: `pay_${String(count + 1).padStart(3, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
    } as any

    payments = [newPayment, ...payments]

    // Update invoice status to paid
    const invIdx = invoices.findIndex((inv) => inv.id === body.invoiceId)
    if (invIdx !== -1) {
      invoices[invIdx] = { ...invoices[invIdx], status: "paid" as const }
    }

    return HttpResponse.json({ data: newPayment, error: null }, { status: 201 })
  }),

  http.post("/api/method/erpnext.controllers.stock_controller.show_accounting_ledger_preview", async ({ request }) => {
    await delay(200)
    const body = (await request.json().catch(() => ({}))) as { docname?: string }
    const docname = body.docname ?? ""
    const columns = [
      { name: "Posting Date", editable: false, width: 110, fieldtype: "Date" },
      { name: "Account", editable: false, width: 110, fieldtype: "Link" },
      { name: "Debit (CAD)", editable: false, width: 110, fieldtype: "Currency" },
      { name: "Credit (CAD)", editable: false, width: 110, fieldtype: "Currency" },
      { name: "Against", editable: false, width: 110, fieldtype: "Data" },
      { name: "Party Type", editable: false, width: 110, fieldtype: "Data" },
      { name: "Party", editable: false, width: 110, fieldtype: "Data" },
      { name: "Cost Center", editable: false, width: 110, fieldtype: "Link" },
      { name: "Against Voucher Type", editable: false, width: 110, fieldtype: "Data" },
      { name: "Against Voucher", editable: false, width: 110, fieldtype: "Data" },
    ]
    const data = [
      ["2026-08-01", "Cash - BE", 0, 200, "Debtors - BE", "Customer", "AlphaCorp", "Main - BE", "Payment Entry", docname],
      ["2026-08-01", "Debtors - BE", 200, 0, "Cash - BE", "Customer", "AlphaCorp", "Main - BE", "Payment Entry", docname],
    ]
    return HttpResponse.json({ message: { gl_columns: columns, gl_data: data }, error: null })
  }),

  // ── Bulk submit/cancel via bulk_update ─────────────────────────────
  http.post("/api/method/frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", async ({ request }) => {
    await delay(200)
    const body = Object.fromEntries(new URLSearchParams(await request.text()))
    const names = safeJson(body.docnames ?? "[]", []) as string[]
    const action = body.action ?? "submit"
    // Dev helper: a doc named "PAY-DUP" simulates the real bench response for
    // a doc that cannot submit — 200 OK, the failed doc in `message`, and the
    // human reason in `_server_messages` (which the list must surface).
    const blocked = names.find((n: string) => n.includes("DUP"))
    if (blocked && action === "submit") {
      return HttpResponse.json({
        message: [blocked],
        _server_messages: JSON.stringify([
          { message: "Sales Invoice ACC-SINV-2026-00051 has already been fully paid.", title: "Message", indicator: "red", raise_exception: 1 },
        ]),
      })
    }
    return HttpResponse.json({ message: [] })
  }),

  // ── Bulk delete via reportview.delete_items ──────────────────────
  http.post("/api/method/frappe.desk.reportview.delete_items", async ({ request }) => {
    await delay(200)
    const body = Object.fromEntries(new URLSearchParams(await request.text()))
    void body
    return HttpResponse.json({ message: null })
  }),

  // ── Export via data_import.download_template ─────────────────────
  http.post("/api/method/frappe.core.doctype.data_import.data_import.download_template", async ({ request }) => {
    await delay(300)
    const body = Object.fromEntries(new URLSearchParams(await request.text()))
    const fields = safeJson(body.export_fields ?? "{}", {}) as Record<string, string[]>
    const parentFields = fields["Payment Entry"] ?? ["name"]
    const header = parentFields.join(",")
    const csv = `${header}\r\n${parentFields.map(() => "value").join(",")}\r\n`
    return new HttpResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    })
  }),

  // ── Bulk print via print_format.download_multi_pdf ──────────────
  http.get("/api/method/frappe.utils.print_format.download_multi_pdf", async () => {
    await delay(300)
    // Minimal valid PDF so the Blob can be downloaded in mock mode.
    const pdf = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
    return new HttpResponse(pdf, {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    })
  }),

  // ── Assign / clearance via assign_to ─────────────────────────────
  http.post("/api/method/frappe.desk.form.assign_to.add_multiple", async ({ request }) => {
    await delay(150)
    const body = Object.fromEntries(new URLSearchParams(await request.text()))
    void body
    return HttpResponse.json({ message: "Document assigned" })
  }),
  http.post("/api/method/frappe.desk.form.assign_to.remove_multiple", async ({ request }) => {
    await delay(150)
    const body = Object.fromEntries(new URLSearchParams(await request.text()))
    void body
    return HttpResponse.json({ message: "Assignments removed" })
  }),

  // ── Tags via tag.add_tags ─────────────────────────────────────────
  http.post("/api/method/frappe.desk.doctype.tag.tag.add_tags", async ({ request }) => {
    await delay(150)
    const body = Object.fromEntries(new URLSearchParams(await request.text()))
    void body
    return HttpResponse.json({ message: "Tags added" })
  }),
]

function safeJson(val: string, fallback: unknown): unknown {
  try { return JSON.parse(val) } catch { return fallback }
}
