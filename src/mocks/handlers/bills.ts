import { http, HttpResponse, delay } from "msw"
import billsData from "../data/bills.json"

let bills = [...billsData]

export const billHandlers = [
  http.get("*/bills", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const status = url.searchParams.get("status") ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = bills
    if (search) filtered = bills.filter((b) => b.number.toLowerCase().includes(search) || b.supplierName.toLowerCase().includes(search))
    if (status) filtered = filtered.filter((b) => b.status === status)

    const total = filtered.length
    const start = (page - 1) * pageSize
    const paged = filtered.slice(start, start + pageSize)

    return HttpResponse.json({ data: { items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }, error: null })
  }),

  http.get("*/bills/:id", async ({ params }) => {
    await delay(200)
    const bill = bills.find((b) => b.id === params.id)
    if (!bill) return HttpResponse.json({ data: null, error: { message: "Bill not found." } }, { status: 404 })
    return HttpResponse.json({ data: bill, error: null })
  }),

  http.post("*/bills", async ({ request }) => {
    await delay(300)
    const body = (await request.json()) as any
    const count = bills.length
    const item = {
      id: `bill_${String(count + 1).padStart(3, "0")}`,
      number: `BILL-2026-${String(count + 1).padStart(4, "0")}`,
      status: "received",
      ...body,
      createdAt: new Date().toISOString(),
    }
    bills = [item, ...bills]
    return HttpResponse.json({ data: item, error: null }, { status: 201 })
  }),

  http.put("*/bills/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as any
    const idx = bills.findIndex((b) => b.id === params.id)
    if (idx === -1) return HttpResponse.json({ data: null, error: { message: "Not found" } }, { status: 404 })
    bills[idx] = { ...bills[idx], ...body }
    return HttpResponse.json({ data: bills[idx], error: null })
  }),

  http.delete("*/bills/:id", async ({ params }) => {
    await delay(200)
    bills = bills.filter((b) => b.id !== params.id)
    return HttpResponse.json({ data: null, error: null })
  }),
]
