import { http, HttpResponse, delay } from "msw"
import bankAccounts from "../data/bank_accounts.json"

let data = [...bankAccounts]

export const bankAccountHandlers = [
  http.get("*/bank-accounts", async ({ request }) => {
    await delay()
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase()
    const page = Number(url.searchParams.get("page")) || 1
    const pageSize = 10
    let items = data
    if (search) items = items.filter((a) => a.name.toLowerCase().includes(search) || a.accountNumber.includes(search))
    const total = items.length
    const paged = items.slice((page - 1) * pageSize, page * pageSize)
    return HttpResponse.json({ data: { items: paged, total }, error: null })
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
