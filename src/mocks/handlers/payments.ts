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
]
