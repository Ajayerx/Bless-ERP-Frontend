import { http, HttpResponse, delay } from "msw"
import opportunities from "../data/opportunities.json"

let data = [...opportunities]

export const opportunityHandlers = [
  http.get("*/opportunities", async ({ request }) => {
    await delay()
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase()
    const page = Number(url.searchParams.get("page")) || 1
    const pageSize = 10
    let items = data
    if (search) items = items.filter((o) => o.title.toLowerCase().includes(search) || o.customerName.toLowerCase().includes(search))
    const total = items.length
    const paged = items.slice((page - 1) * pageSize, page * pageSize)
    return HttpResponse.json({ data: { items: paged, total }, error: null })
  }),

  http.get("*/opportunities/:id", async ({ params }) => {
    await delay()
    const item = data.find((o) => o.id === params.id)
    if (!item) return HttpResponse.json({ data: null, error: { message: "Not found" } }, { status: 404 })
    return HttpResponse.json({ data: item, error: null })
  }),

  http.post("*/opportunities", async ({ request }) => {
    await delay()
    const body = (await request.json()) as any
    const item = { ...body, id: `opp_${Date.now()}`, createdAt: new Date().toISOString() }
    data.push(item)
    return HttpResponse.json({ data: item, error: null }, { status: 201 })
  }),

  http.put("*/opportunities/:id", async ({ params, request }) => {
    await delay()
    const body = (await request.json()) as any
    const idx = data.findIndex((o) => o.id === params.id)
    if (idx === -1) return HttpResponse.json({ data: null, error: { message: "Not found" } }, { status: 404 })
    data[idx] = { ...data[idx], ...body }
    return HttpResponse.json({ data: data[idx], error: null })
  }),

  http.delete("*/opportunities/:id", async ({ params }) => {
    await delay()
    data = data.filter((o) => o.id !== params.id)
    return HttpResponse.json({ data: null, error: null })
  }),
]
