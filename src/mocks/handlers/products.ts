import { http, HttpResponse, delay } from "msw"
import productsData from "../data/products.json"
import type { Product } from "@/services/products.service"

const products: Product[] = productsData as Product[]

export const productsHandlers = [
    http.get("/api/products", async ({ request }) => {
        await delay(300)
        const url = new URL(request.url)
        const search = url.searchParams.get("search") ?? ""
        const page = parseInt(url.searchParams.get("page") ?? "1", 10)
        const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)
        const filter = url.searchParams.get("filter") ?? "All"

        let filtered = products

        // search
        if (search.trim()) {
            const q = search.toLowerCase()
            filtered = filtered.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    p.sku.toLowerCase().includes(q)
            )
        }

        // stock filter
        if (filter === "Low Stock") {
            filtered = filtered.filter((p) => p.stock > 0 && p.stock < 20)
        } else if (filter === "In Stock") {
            filtered = filtered.filter((p) => p.stock >= 20)
        } else if (filter === "Out of Stock") {
            filtered = filtered.filter((p) => p.stock === 0)
        }

        const total = filtered.length
        const start = (page - 1) * pageSize
        const items = filtered.slice(start, start + pageSize)

        return HttpResponse.json({ data: { items, total }, error: null })
    }),

    http.get("/api/products/:id", ({ params }) => {
        const product = products.find((p) => p.id === params.id)
        if (!product) return HttpResponse.json({ data: null, error: { message: "Product not found." } }, { status: 404 })
        return HttpResponse.json({ data: product, error: null })
    }),

    http.post("/api/products", async ({ request }) => {
        const body = (await request.json()) as Omit<Product, "id">
        const newProduct: Product = {
            ...body,
            id: `prd_${Date.now()}`,
        }
        products.push(newProduct)
        return HttpResponse.json({ data: newProduct, error: null }, { status: 201 })
    }),

    http.put("/api/products/:id", async ({ params, request }) => {
        const idx = products.findIndex((p) => p.id === params.id)
        if (idx === -1) return new HttpResponse(null, { status: 404 })
        const body = (await request.json()) as Partial<Product>
        products[idx] = { ...products[idx], ...body }
        return HttpResponse.json({ data: products[idx], error: null })
    }),

    http.delete("/api/products/:id", ({ params }) => {
        const idx = products.findIndex((p) => p.id === params.id)
        if (idx === -1) return new HttpResponse(null, { status: 404 })
        products.splice(idx, 1)
        return new HttpResponse(null, { status: 204 })
    }),
]