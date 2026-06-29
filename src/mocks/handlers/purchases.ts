import { http, HttpResponse, delay } from "msw"
import purchaseOrdersData from "../data/purchase-orders.json"
import vendorsData from "../data/vendors.json"
import billsData from "../data/bills.json"

let purchaseOrders = [...purchaseOrdersData]
let vendors = [...vendorsData]
let bills = [...billsData]

// ── Purchase Orders ──────────────────────────────────────────
const poHandlers = [
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

// ── Vendors ──────────────────────────────────────────────────
const vendorHandlers = [
  http.get("/api/vendors", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = vendors
    if (search) {
      filtered = filtered.filter(
        (v) =>
          v.name.toLowerCase().includes(search) ||
          v.contactName.toLowerCase().includes(search) ||
          v.email.toLowerCase().includes(search)
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

  http.get("/api/vendors/:id", async ({ params }) => {
    await delay(200)
    const vendor = vendors.find((v) => v.id === params.id)
    if (!vendor) {
      return HttpResponse.json(
        { data: null, error: { message: "Vendor not found." } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ data: vendor, error: null })
  }),

  http.post("/api/vendors", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newVendor = {
      id: `ven_${String(vendors.length + 1).padStart(3, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
    } as any
    vendors = [newVendor, ...vendors]
    return HttpResponse.json({ data: newVendor, error: null }, { status: 201 })
  }),

  http.put("/api/vendors/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = vendors.findIndex((v) => v.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { message: "Vendor not found." } },
        { status: 404 }
      )
    }
    vendors[idx] = { ...vendors[idx], ...(body as any) }
    return HttpResponse.json({ data: vendors[idx], error: null })
  }),
]

// ── Bills ────────────────────────────────────────────────────
const billHandlers = [
  http.get("/api/bills", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = bills
    if (search) {
      filtered = filtered.filter(
        (b) =>
          b.number.toLowerCase().includes(search) ||
          b.vendorName.toLowerCase().includes(search)
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

  http.get("/api/bills/:id", async ({ params }) => {
    await delay(200)
    const bill = bills.find((b) => b.id === params.id)
    if (!bill) {
      return HttpResponse.json(
        { data: null, error: { message: "Bill not found." } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ data: bill, error: null })
  }),

  http.post("/api/bills", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newBill = {
      id: `bil_${String(bills.length + 1).padStart(3, "0")}`,
      number: `BILL-2026-${String(bills.length + 1).padStart(4, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
    } as any
    bills = [newBill, ...bills]
    return HttpResponse.json({ data: newBill, error: null }, { status: 201 })
  }),

  http.put("/api/bills/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = bills.findIndex((b) => b.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { message: "Bill not found." } },
        { status: 404 }
      )
    }
    bills[idx] = { ...bills[idx], ...(body as any) }
    return HttpResponse.json({ data: bills[idx], error: null })
  }),
]

export const purchaseOrderHandlers = [...poHandlers, ...vendorHandlers, ...billHandlers]
