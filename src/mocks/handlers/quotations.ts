import { http, HttpResponse, delay } from "msw"
import quotationsData from "../data/quotations.json"

let quotations = [...quotationsData]

export const quotationHandlers = [
  http.get("*/quotations", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const status = url.searchParams.get("status") ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = quotations
    if (search) filtered = quotations.filter((q) => q.number.toLowerCase().includes(search) || q.customerName.toLowerCase().includes(search))
    if (status) filtered = filtered.filter((q) => q.status === status)

    const total = filtered.length
    const start = (page - 1) * pageSize
    const paged = filtered.slice(start, start + pageSize)

    return HttpResponse.json({ data: { items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }, error: null })
  }),

  http.get("*/quotations/:id", async ({ params }) => {
    await delay(200)
    const qtn = quotations.find((q) => q.id === params.id)
    if (!qtn) return HttpResponse.json({ data: null, error: { message: "Quotation not found." } }, { status: 404 })
    return HttpResponse.json({ data: qtn, error: null })
  }),

  http.post("*/quotations", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const count = quotations.length
    const newQuotation = {
      id: `qtn_${String(count + 1).padStart(3, "0")}`,
      number: `QTN-2026-${String(count + 1).padStart(4, "0")}`,
      status: "draft" as const,
      ...body,
      createdAt: new Date().toISOString(),
    }
    quotations = [newQuotation, ...quotations]
    return HttpResponse.json({ data: newQuotation, error: null }, { status: 201 })
  }),

  http.put("*/quotations/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as any
    const idx = quotations.findIndex((q) => q.id === params.id)
    if (idx === -1) return HttpResponse.json({ data: null, error: { message: "Not found" } }, { status: 404 })
    quotations[idx] = { ...quotations[idx], ...body }
    return HttpResponse.json({ data: quotations[idx], error: null })
  }),

  http.delete("*/quotations/:id", async ({ params }) => {
    await delay(200)
    quotations = quotations.filter((q) => q.id !== params.id)
    return HttpResponse.json({ data: null, error: null })
  }),
]
