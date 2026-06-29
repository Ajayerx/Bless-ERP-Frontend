import { http, HttpResponse, delay } from "msw"
import productsData from "../data/products.json"

let products = [...productsData]

export const productHandlers = [
  http.get("/api/products", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const pageParam = url.searchParams.get("page")

    // If no page param, return simple array for invoice dropdown (backward compat)
    if (!pageParam) {
      return HttpResponse.json({ data: products, error: null })
    }

    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const page = parseInt(pageParam, 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = products
    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.sku.toLowerCase().includes(search)
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

  http.get("/api/products/:id", async ({ params }) => {
    await delay(200)
    const product = products.find((p) => p.id === params.id)
    if (!product) {
      return HttpResponse.json(
        { data: null, error: { message: "Product not found." } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ data: product, error: null })
  }),

  http.post("/api/products", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newProduct = {
      id: `prd_${String(products.length + 1).padStart(3, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
    } as any
    products = [newProduct, ...products]
    return HttpResponse.json({ data: newProduct, error: null }, { status: 201 })
  }),

  http.put("/api/products/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = products.findIndex((p) => p.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { message: "Product not found." } },
        { status: 404 }
      )
    }
    products[idx] = { ...products[idx], ...(body as any) }
    return HttpResponse.json({ data: products[idx], error: null })
  }),
]
