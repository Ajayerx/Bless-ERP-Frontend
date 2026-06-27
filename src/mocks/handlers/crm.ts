import { http, HttpResponse, delay } from "msw"
import contactsData from "../data/contacts.json"
import leadsData from "../data/leads.json"
import opportunitiesData from "../data/opportunities.json"
import followUpsData from "../data/follow-ups.json"

let contacts = [...contactsData]
let leads = [...leadsData]
let opportunities = [...opportunitiesData]
let followUps = [...followUpsData]

function paginate<T>(items: T[], url: URL) {
  const search = url.searchParams.get("search")?.toLowerCase() ?? ""
  const page = parseInt(url.searchParams.get("page") ?? "1", 10)
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

  let filtered = items
  if (search) {
    filtered = filtered.filter((item: any) =>
      Object.values(item).some((v) => String(v).toLowerCase().includes(search))
    )
  }

  const total = filtered.length
  const start = (page - 1) * pageSize
  const paged = filtered.slice(start, start + pageSize)

  return { items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

function crudHandlers<T extends { id: string }>(endpoint: string, store: T[], idPrefix: string) {
  return [
    http.get(`/api/${endpoint}`, async ({ request }) => {
      await delay(300)
      const url = new URL(request.url)

      if (endpoint === "follow-ups") {
        const status = url.searchParams.get("status")
        let filtered = store as any
        if (status) filtered = filtered.filter((f: any) => f.status === status)
        return HttpResponse.json({ data: paginate(filtered, url), error: null })
      }

      return HttpResponse.json({ data: paginate(store, url), error: null })
    }),

    http.get(`/api/${endpoint}/:id`, async ({ params }) => {
      await delay(200)
      const item = store.find((s: any) => s.id === params.id)
      if (!item) return HttpResponse.json({ data: null, error: { message: "Not found." } }, { status: 404 })
      return HttpResponse.json({ data: item, error: null })
    }),

    http.post(`/api/${endpoint}`, async ({ request }) => {
      await delay(400)
      const body = (await request.json()) as Record<string, unknown>
      const newItem = { id: `${idPrefix}${String(store.length + 1).padStart(3, "0")}`, ...body, createdAt: new Date().toISOString() } as any
      store.unshift(newItem)
      return HttpResponse.json({ data: newItem, error: null }, { status: 201 })
    }),

    http.put(`/api/${endpoint}/:id`, async ({ params, request }) => {
      await delay(300)
      const body = (await request.json()) as Record<string, unknown>
      const idx = store.findIndex((s: any) => s.id === params.id)
      if (idx === -1) return HttpResponse.json({ data: null, error: { message: "Not found." } }, { status: 404 })
      store[idx] = { ...store[idx], ...(body as any) }
      return HttpResponse.json({ data: store[idx], error: null })
    }),

    http.delete(`/api/${endpoint}/:id`, async ({ params }) => {
      await delay(200)
      const idx = store.findIndex((s: any) => s.id === params.id)
      if (idx === -1) return HttpResponse.json({ data: null, error: { message: "Not found." } }, { status: 404 })
      store.splice(idx, 1)
      return HttpResponse.json({ data: null, error: null })
    }),
  ]
}

export const crmHandlers = [
  ...crudHandlers("contacts", contacts, "con_"),
  ...crudHandlers("leads", leads, "ld_"),
  ...crudHandlers("opportunities", opportunities, "opp_"),
  ...crudHandlers("follow-ups", followUps, "fu_"),
]
