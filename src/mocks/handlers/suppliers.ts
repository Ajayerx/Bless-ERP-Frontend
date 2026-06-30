import { http, HttpResponse, delay } from "msw"
import suppliersData from "../data/suppliers.json"

let suppliers = [...suppliersData]

export const supplierHandlers = [
  http.get("/api/suppliers", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = suppliers
    if (search) {
      filtered = suppliers.filter(
        (s) => s.name.toLowerCase().includes(search) || s.contactName.toLowerCase().includes(search)
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

  http.get("/api/suppliers/:id", async ({ params }) => {
    await delay(200)
    const supplier = suppliers.find((s) => s.id === params.id)
    if (!supplier) return HttpResponse.json({ data: null, error: { message: "Supplier not found." } }, { status: 404 })
    return HttpResponse.json({ data: supplier, error: null })
  }),

  http.post("/api/suppliers", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newSupplier = { id: `sup_${Date.now()}`, ...body, balance: 0, status: "active", createdAt: new Date().toISOString() }
    suppliers = [newSupplier, ...suppliers] as any
    return HttpResponse.json({ data: newSupplier, error: null }, { status: 201 })
  }),

  http.put("/api/suppliers/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = suppliers.findIndex((s) => s.id === params.id)
    if (idx === -1) return HttpResponse.json({ data: null, error: { message: "Supplier not found." } }, { status: 404 })
    suppliers[idx] = { ...suppliers[idx], ...(body as any) }
    return HttpResponse.json({ data: suppliers[idx], error: null })
  }),
]
