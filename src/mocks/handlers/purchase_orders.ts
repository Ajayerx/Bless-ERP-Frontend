import { http, HttpResponse, delay } from "msw"
import purchaseOrdersData from "../data/purchase_orders.json"

let purchaseOrders = [...purchaseOrdersData]

export const purchaseOrderHandlers = [
  http.get("*/purchase-orders", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const status = url.searchParams.get("status") ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = purchaseOrders
    if (search) filtered = purchaseOrders.filter((po) => po.number.toLowerCase().includes(search) || po.supplierName.toLowerCase().includes(search))
    if (status) filtered = filtered.filter((po) => po.status === status)

    const total = filtered.length
    const start = (page - 1) * pageSize
    const paged = filtered.slice(start, start + pageSize)

    return HttpResponse.json({ data: { items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }, error: null })
  }),

  http.get("*/purchase-orders/:id", async ({ params }) => {
    await delay(200)
    const po = purchaseOrders.find((p) => p.id === params.id)
    if (!po) return HttpResponse.json({ data: null, error: { message: "Purchase order not found" } }, { status: 404 })
    return HttpResponse.json({ data: po, error: null })
  }),

  http.post("*/purchase-orders", async ({ request }) => {
    await delay(300)
    const body = (await request.json()) as any
    const count = purchaseOrders.length
    const item = {
      id: `po_${String(count + 1).padStart(3, "0")}`,
      number: `PO-2026-${String(count + 1).padStart(4, "0")}`,
      status: "draft",
      ...body,
      createdAt: new Date().toISOString(),
    }
    purchaseOrders = [item, ...purchaseOrders]
    return HttpResponse.json({ data: item, error: null }, { status: 201 })
  }),

  http.put("*/purchase-orders/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as any
    const idx = purchaseOrders.findIndex((p) => p.id === params.id)
    if (idx === -1) return HttpResponse.json({ data: null, error: { message: "Not found" } }, { status: 404 })
    purchaseOrders[idx] = { ...purchaseOrders[idx], ...body }
    return HttpResponse.json({ data: purchaseOrders[idx], error: null })
  }),

  http.delete("*/purchase-orders/:id", async ({ params }) => {
    await delay(200)
    purchaseOrders = purchaseOrders.filter((p) => p.id !== params.id)
    return HttpResponse.json({ data: null, error: null })
  }),
]
