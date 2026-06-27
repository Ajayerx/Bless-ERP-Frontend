import { http, HttpResponse, delay } from "msw"
import warehousesData from "../data/warehouses.json"
import stockTransfersData from "../data/stock-transfers.json"
import stockCountsData from "../data/stock-counts.json"
import inventoryMovementsData from "../data/inventory-movements.json"
import productsData from "../data/products.json"

let warehouses = [...warehousesData]
let stockTransfers = [...stockTransfersData]
let stockCounts = [...stockCountsData]
let inventoryMovements = [...inventoryMovementsData]

function paginate<T>(items: T[], url: URL): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  const search = url.searchParams.get("search")?.toLowerCase() ?? ""
  const page = parseInt(url.searchParams.get("page") ?? "1", 10)
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

  let filtered = items
  if (search) {
    filtered = filtered.filter((item: any) =>
      Object.values(item).some((v) => String(v).toLowerCase().includes(search))
    )
  }

  const total = filtered.length
  const start = (page - 1) * pageSize
  const paged = filtered.slice(start, start + pageSize)

  return { items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export const inventoryHandlers = [
  // --- Warehouses ---
  http.get("/api/warehouses", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    return HttpResponse.json({ data: paginate(warehouses, url), error: null })
  }),

  http.get("/api/warehouses/:id", async ({ params }) => {
    await delay(200)
    const warehouse = warehouses.find((w) => w.id === params.id)
    if (!warehouse) {
      return HttpResponse.json(
        { data: null, error: { message: "Warehouse not found." } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ data: warehouse, error: null })
  }),

  http.post("/api/warehouses", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newWarehouse = {
      id: `wh_${String(warehouses.length + 1).padStart(3, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
    } as any
    warehouses = [newWarehouse, ...warehouses]
    return HttpResponse.json({ data: newWarehouse, error: null }, { status: 201 })
  }),

  http.put("/api/warehouses/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = warehouses.findIndex((w) => w.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { message: "Warehouse not found." } },
        { status: 404 }
      )
    }
    warehouses[idx] = { ...warehouses[idx], ...(body as any) }
    return HttpResponse.json({ data: warehouses[idx], error: null })
  }),

  // --- Stock Transfers ---
  http.get("/api/stock-transfers", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    return HttpResponse.json({ data: paginate(stockTransfers, url), error: null })
  }),

  http.get("/api/stock-transfers/:id", async ({ params }) => {
    await delay(200)
    const transfer = stockTransfers.find((t) => t.id === params.id)
    if (!transfer) {
      return HttpResponse.json(
        { data: null, error: { message: "Stock transfer not found." } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ data: transfer, error: null })
  }),

  http.post("/api/stock-transfers", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newTransfer = {
      id: `st_${String(stockTransfers.length + 1).padStart(3, "0")}`,
      reference: `ST-2026-${String(stockTransfers.length + 1).padStart(4, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
      completedAt: null,
    } as any
    stockTransfers = [newTransfer, ...stockTransfers]
    return HttpResponse.json({ data: newTransfer, error: null }, { status: 201 })
  }),

  http.put("/api/stock-transfers/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = stockTransfers.findIndex((t) => t.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { message: "Stock transfer not found." } },
        { status: 404 }
      )
    }
    stockTransfers[idx] = { ...stockTransfers[idx], ...(body as any) }
    if (body.status === "completed") {
      stockTransfers[idx].completedAt = new Date().toISOString()
    }
    return HttpResponse.json({ data: stockTransfers[idx], error: null })
  }),

  // --- Stock Counts ---
  http.get("/api/stock-counts", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    return HttpResponse.json({ data: paginate(stockCounts, url), error: null })
  }),

  http.get("/api/stock-counts/:id", async ({ params }) => {
    await delay(200)
    const count = stockCounts.find((c) => c.id === params.id)
    if (!count) {
      return HttpResponse.json(
        { data: null, error: { message: "Stock count not found." } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ data: count, error: null })
  }),

  http.post("/api/stock-counts", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newCount = {
      id: `sc_${String(stockCounts.length + 1).padStart(3, "0")}`,
      reference: `SC-2026-${String(stockCounts.length + 1).padStart(4, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
      completedAt: null,
    } as any
    stockCounts = [newCount, ...stockCounts]
    return HttpResponse.json({ data: newCount, error: null }, { status: 201 })
  }),

  http.put("/api/stock-counts/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = stockCounts.findIndex((c) => c.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { message: "Stock count not found." } },
        { status: 404 }
      )
    }
    stockCounts[idx] = { ...stockCounts[idx], ...(body as any) }
    if (body.status === "completed") {
      stockCounts[idx].completedAt = new Date().toISOString()
    }
    return HttpResponse.json({ data: stockCounts[idx], error: null })
  }),

  // --- Inventory Movements ---
  http.get("/api/inventory-movements", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const productId = url.searchParams.get("productId")
    const warehouse = url.searchParams.get("warehouse")
    const type = url.searchParams.get("type")

    let filtered = [...inventoryMovements]
    if (productId) filtered = filtered.filter((m) => m.productId === productId)
    if (warehouse) filtered = filtered.filter((m) => m.warehouse.toLowerCase().includes(warehouse.toLowerCase()))
    if (type) filtered = filtered.filter((m) => m.type === type)

    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)
    const total = filtered.length
    const start = (page - 1) * pageSize
    const paged = filtered.slice(start, start + pageSize)

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

  // --- Inventory Summary ---
  http.get("/api/inventory/summary", async () => {
    await delay(300)
    const totalProducts = productsData.length
    const totalValue = productsData.reduce((sum, p) => sum + p.price * p.stock, 0)
    const lowStockCount = productsData.filter((p) => p.stock > 0 && p.stock < 10).length
    const outOfStockCount = productsData.filter((p) => p.stock === 0).length
    const pendingTransfers = stockTransfers.filter((t) => t.status === "in_transit" || t.status === "draft").length
    const pendingCounts = stockCounts.filter((c) => c.status === "in_progress" || c.status === "draft").length

    return HttpResponse.json({
      data: {
        totalProducts,
        totalWarehouses: warehouses.length,
        totalValue,
        lowStockCount,
        outOfStockCount,
        pendingTransfers,
        pendingCounts,
      },
      error: null,
    })
  }),
]
