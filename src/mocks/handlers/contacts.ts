import { http, HttpResponse, delay } from "msw"
import contacts from "../data/contacts.json"

let data = [...contacts]

export const contactHandlers = [
  http.get("*/contacts", async ({ request }) => {
    await delay()
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase()
    const page = Number(url.searchParams.get("page")) || 1
    const customerId = url.searchParams.get("customerId")
    const pageSize = 10
    let items = data
    if (customerId) items = items.filter((c) => c.customerId === customerId)
    if (search) items = items.filter((c) => c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search))
    const total = items.length
    const paged = items.slice((page - 1) * pageSize, page * pageSize)
    return HttpResponse.json({ data: { items: paged, total }, error: null })
  }),

  http.get("*/contacts/:id", async ({ params }) => {
    await delay()
    const item = data.find((c) => c.id === params.id)
    if (!item) return HttpResponse.json({ data: null, error: { message: "Not found" } }, { status: 404 })
    return HttpResponse.json({ data: item, error: null })
  }),

  http.post("*/contacts", async ({ request }) => {
    await delay()
    const body = (await request.json()) as any
    const item = { ...body, id: `cnt_${Date.now()}`, createdAt: new Date().toISOString() }
    data.push(item)
    return HttpResponse.json({ data: item, error: null }, { status: 201 })
  }),

  http.put("*/contacts/:id", async ({ params, request }) => {
    await delay()
    const body = (await request.json()) as any
    const idx = data.findIndex((c) => c.id === params.id)
    if (idx === -1) return HttpResponse.json({ data: null, error: { message: "Not found" } }, { status: 404 })
    data[idx] = { ...data[idx], ...body }
    return HttpResponse.json({ data: data[idx], error: null })
  }),

  http.delete("*/contacts/:id", async ({ params }) => {
    await delay()
    data = data.filter((c) => c.id !== params.id)
    return HttpResponse.json({ data: null, error: null })
  }),
]
