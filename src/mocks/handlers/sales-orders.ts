import { http, HttpResponse, delay } from "msw"
import salesOrdersData from "../data/sales-orders.json"

let salesOrders = [...salesOrdersData]

export const salesOrderHandlers = [
  http.get("/api/sales-orders", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = salesOrders
    if (search) {
      filtered = filtered.filter(
        (so) =>
          so.number.toLowerCase().includes(search) ||
          so.customerName.toLowerCase().includes(search)
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

  http.get("/api/sales-orders/:id", async ({ params }) => {
    await delay(200)
    const salesOrder = salesOrders.find((so) => so.id === params.id)
    if (!salesOrder) {
      return HttpResponse.json(
        { data: null, error: { message: "Sales order not found." } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ data: salesOrder, error: null })
  }),

  http.post("/api/sales-orders", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newOrder = {
      id: `so_${String(salesOrders.length + 1).padStart(3, "0")}`,
      number: `SO-2026-${String(salesOrders.length + 1).padStart(4, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
    } as any
    salesOrders = [newOrder, ...salesOrders]
    return HttpResponse.json({ data: newOrder, error: null }, { status: 201 })
  }),

  http.put("/api/sales-orders/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = salesOrders.findIndex((so) => so.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { message: "Sales order not found." } },
        { status: 404 }
      )
    }
    salesOrders[idx] = { ...salesOrders[idx], ...(body as any) }
    return HttpResponse.json({ data: salesOrders[idx], error: null })
  }),
]
