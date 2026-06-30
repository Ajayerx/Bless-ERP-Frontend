import { http, HttpResponse, delay } from "msw"
import journalEntries from "../data/journal_entries.json"

let data = [...journalEntries]

export const journalEntryHandlers = [
  http.get("*/journal-entries", async ({ request }) => {
    await delay()
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page")) || 1
    const pageSize = Number(url.searchParams.get("pageSize")) || 10
    const start = (page - 1) * pageSize
    const items = data.slice(start, start + pageSize)
    return HttpResponse.json({ data: { items, total: data.length, page, pageSize }, error: null })
  }),

  http.get("*/journal-entries/:id", async ({ params }) => {
    await delay()
    const item = data.find((j) => j.id === params.id)
    if (!item) return HttpResponse.json({ data: null, error: { message: "Not found" } }, { status: 404 })
    return HttpResponse.json({ data: item, error: null })
  }),

  http.post("*/journal-entries", async ({ request }) => {
    await delay()
    const body = (await request.json()) as any
    const item = { ...body, id: `je_${Date.now()}`, number: `JE-2026-${String(data.length + 1).padStart(4, "0")}`, createdAt: new Date().toISOString() }
    data.push(item)
    return HttpResponse.json({ data: item, error: null }, { status: 201 })
  }),

  http.put("*/journal-entries/:id", async ({ params, request }) => {
    await delay()
    const body = (await request.json()) as any
    const idx = data.findIndex((j) => j.id === params.id)
    if (idx === -1) return HttpResponse.json({ data: null, error: { message: "Not found" } }, { status: 404 })
    data[idx] = { ...data[idx], ...body }
    return HttpResponse.json({ data: data[idx], error: null })
  }),

  http.delete("*/journal-entries/:id", async ({ params }) => {
    await delay()
    data = data.filter((j) => j.id !== params.id)
    return HttpResponse.json({ data: null, error: null })
  }),
]
