import { http, HttpResponse, delay } from "msw"
import quotationsData from "../data/quotations.json"

let quotations = [...quotationsData]

export const quotationHandlers = [
  http.get("/api/quotations", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = quotations
    if (search) {
      filtered = filtered.filter(
        (q) =>
          q.number.toLowerCase().includes(search) ||
          q.customerName.toLowerCase().includes(search)
      )
    }

    const total = filtered.length
    const start = (page - 1) * pageSize
    const paged = filtered.slice(start, start + pageSize)

    return HttpResponse.json({
      data: { items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      error: null,
    })
  }),

  http.get("/api/quotations/:id", async ({ params }) => {
    await delay(200)
    const quotation = quotations.find((q) => q.id === params.id)
    if (!quotation) {
      return HttpResponse.json(
        { data: null, error: { message: "Quotation not found." } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ data: quotation, error: null })
  }),

  http.post("/api/quotations", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newQuotation = {
      id: `qtn_${String(quotations.length + 1).padStart(3, "0")}`,
      number: `QTN-2026-${String(quotations.length + 1).padStart(4, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
    } as any
    quotations = [newQuotation, ...quotations]
    return HttpResponse.json({ data: newQuotation, error: null }, { status: 201 })
  }),

  http.put("/api/quotations/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = quotations.findIndex((q) => q.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { message: "Quotation not found." } },
        { status: 404 }
      )
    }
    quotations[idx] = { ...quotations[idx], ...(body as any) }
    return HttpResponse.json({ data: quotations[idx], error: null })
  }),
]
