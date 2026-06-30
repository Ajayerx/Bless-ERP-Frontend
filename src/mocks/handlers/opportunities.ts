import { http, HttpResponse, delay } from "msw"
import opportunities from "../data/opportunities.json"

let data = [...opportunities]

export const opportunityHandlers = [
  http.get("*/opportunities", async () => {
    await delay()
    return HttpResponse.json({ data: { items: data, total: data.length }, error: null })
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
