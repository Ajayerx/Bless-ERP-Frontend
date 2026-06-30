import { http, HttpResponse, delay } from "msw"
import bankAccounts from "../data/bank_accounts.json"

let data = [...bankAccounts]

export const bankAccountHandlers = [
  http.get("*/bank-accounts", async () => {
    await delay()
    return HttpResponse.json({ data: { items: data, total: data.length }, error: null })
  }),

  http.get("*/bank-accounts/:id", async ({ params }) => {
    await delay()
    const item = data.find((a) => a.id === params.id)
    if (!item) return HttpResponse.json({ data: null, error: { message: "Not found" } }, { status: 404 })
    return HttpResponse.json({ data: item, error: null })
  }),

  http.post("*/bank-accounts", async ({ request }) => {
    await delay()
    const body = (await request.json()) as any
    const item = { ...body, id: `ba_${Date.now()}`, createdAt: new Date().toISOString() }
    data.push(item)
    return HttpResponse.json({ data: item, error: null }, { status: 201 })
  }),

  http.put("*/bank-accounts/:id", async ({ params, request }) => {
    await delay()
    const body = (await request.json()) as any
    const idx = data.findIndex((a) => a.id === params.id)
    if (idx === -1) return HttpResponse.json({ data: null, error: { message: "Not found" } }, { status: 404 })
    data[idx] = { ...data[idx], ...body }
    return HttpResponse.json({ data: data[idx], error: null })
  }),

  http.delete("*/bank-accounts/:id", async ({ params }) => {
    await delay()
    data = data.filter((a) => a.id !== params.id)
    return HttpResponse.json({ data: null, error: null })
  }),
]
