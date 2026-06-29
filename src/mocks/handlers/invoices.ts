import { http, HttpResponse, delay } from "msw"
import invoicesData from "../data/invoices.json"

let invoices = [...invoicesData]

export const invoiceHandlers = [
  http.get("/api/invoices", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const customerId = url.searchParams.get("customerId") ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = invoices
    if (customerId) {
      filtered = filtered.filter((inv) => inv.customerId === customerId)
    }
    if (search) {
      filtered = filtered.filter(
        (inv) =>
          inv.number.toLowerCase().includes(search) ||
          inv.customerName.toLowerCase().includes(search)
      )
    }

    filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    const total = filtered.length
    const start = (page - 1) * pageSize
    const paged = filtered.slice(start, start + pageSize)

    return HttpResponse.json({
      data: { items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      error: null,
    })
  }),

  http.get("/api/invoices/:id", async ({ params }) => {
    await delay(200)
    const invoice = invoices.find((inv) => inv.id === params.id)
    if (!invoice) {
      return HttpResponse.json(
        { data: null, error: { message: "Invoice not found." } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ data: invoice, error: null })
  }),

  http.post("/api/invoices", async ({ request }) => {
    await delay(500)
    const body = (await request.json()) as Record<string, unknown>
    const count = invoices.length
    const newInvoice = {
      id: `inv_${String(count + 1).padStart(3, "0")}`,
      number: `INV-2026-${String(42 + count + 1).padStart(4, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
    } as any
    invoices = [newInvoice, ...invoices]
    return HttpResponse.json({ data: newInvoice, error: null }, { status: 201 })
  }),

  http.put("/api/invoices/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = invoices.findIndex((inv) => inv.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { message: "Invoice not found." } },
        { status: 404 }
      )
    }
    invoices[idx] = { ...invoices[idx], ...(body as any) }
    return HttpResponse.json({ data: invoices[idx], error: null })
  }),

]
