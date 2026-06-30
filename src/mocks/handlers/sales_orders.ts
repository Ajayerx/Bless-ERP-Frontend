import { http, HttpResponse, delay } from "msw"
import salesOrdersData from "../data/sales_orders.json"

let salesOrders = [...salesOrdersData]

export const salesOrderHandlers = [
  http.get("/api/sales-orders", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const status = url.searchParams.get("status") ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = salesOrders
    if (search) filtered = salesOrders.filter((so) => so.number.toLowerCase().includes(search) || so.customerName.toLowerCase().includes(search))
    if (status) filtered = filtered.filter((so) => so.status === status)

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
    const so = salesOrders.find((s) => s.id === params.id)
    if (!so) return HttpResponse.json({ data: null, error: { message: "Sales order not found." } }, { status: 404 })
    return HttpResponse.json({ data: so, error: null })
  }),
]
