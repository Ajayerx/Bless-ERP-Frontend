import { http, HttpResponse, delay } from "msw"
import purchaseOrdersData from "../data/purchase-orders.json"

let purchaseOrders = [...purchaseOrdersData]

export const purchaseOrderHandlers = [
  http.get("/api/purchase-orders", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = purchaseOrders
    if (search) {
      filtered = filtered.filter(
        (po) =>
          po.number.toLowerCase().includes(search) ||
          po.vendorName.toLowerCase().includes(search)
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

  http.get("/api/purchase-orders/:id", async ({ params }) => {
    await delay(200)
    const order = purchaseOrders.find((po) => po.id === params.id)
    if (!order) {
      return HttpResponse.json(
        { data: null, error: { message: "Purchase order not found." } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ data: order, error: null })
  }),

  http.post("/api/purchase-orders", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newOrder = {
      id: `po_${String(purchaseOrders.length + 1).padStart(3, "0")}`,
      number: `PO-2026-${String(purchaseOrders.length + 1).padStart(4, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
    } as any
    purchaseOrders = [newOrder, ...purchaseOrders]
    return HttpResponse.json({ data: newOrder, error: null }, { status: 201 })
  }),

  http.put("/api/purchase-orders/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = purchaseOrders.findIndex((po) => po.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { message: "Purchase order not found." } },
        { status: 404 }
      )
    }
    purchaseOrders[idx] = { ...purchaseOrders[idx], ...(body as any) }
    return HttpResponse.json({ data: purchaseOrders[idx], error: null })
  }),
]
