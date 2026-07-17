import { http, HttpResponse, delay } from "msw"

interface NotificationRow {
  name: string
  subject: string
  type: string
  creation: string
  read: number
  from_user: string
}

const now = new Date()

const mockNotifications: NotificationRow[] = [
  {
    name: "NOTIF-001",
    subject: "Invoice #SINV-2024-00123 is overdue by 7 days",
    type: "Danger",
    creation: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    read: 0,
    from_user: "Administrator",
  },
  {
    name: "NOTIF-002",
    subject: "Payment received: $5,200.00 from Acme Corp",
    type: "Success",
    creation: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
    read: 0,
    from_user: "Administrator",
  },
  {
    name: "NOTIF-003",
    subject: "Low stock alert: Widget Assembly (3 remaining, reorder at 10)",
    type: "Warning",
    creation: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    read: 0,
    from_user: "System",
  },
  {
    name: "NOTIF-004",
    subject: "Purchase Order #PO-2024-00045 submitted for approval",
    type: "Info",
    creation: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    read: 1,
    from_user: "Administrator",
  },
  {
    name: "NOTIF-005",
    subject: "Stock transfer #STK-TRN-00012 completed successfully",
    type: "Success",
    creation: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    read: 1,
    from_user: "System",
  },
  {
    name: "NOTIF-006",
    subject: "New quotation #QTN-2024-00078 created for Beta LLC",
    type: "Info",
    creation: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    read: 1,
    from_user: "Administrator",
  },
  {
    name: "NOTIF-007",
    subject: "Expense report #EXP-2024-00034 pending approval",
    type: "Warning",
    creation: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    read: 1,
    from_user: "System",
  },
]

export const notificationHandlers = [
  // GET /resource/Notification Log — list
  http.get("*/resource/Notification%20Log", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const filtersRaw = url.searchParams.get("filters")
    const limitRaw = url.searchParams.get("limit_page_length")

    let results = [...mockNotifications]

    if (filtersRaw) {
      try {
        const filters = JSON.parse(filtersRaw) as unknown[]
        for (const f of filters) {
          if (Array.isArray(f) && f.length === 3) {
            const [field, op, value] = f as [string, string, unknown]
            if (field === "read" && op === "=") {
              results = results.filter((r) => r.read === Number(value))
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    const limit = limitRaw ? parseInt(limitRaw, 10) : 0
    if (limit > 0) results = results.slice(0, limit)

    return HttpResponse.json({ data: results })
  }),

  // GET /resource/Notification Log/{name} — single
  http.get("*/resource/Notification%20Log/:name", async ({ params }) => {
    await delay(200)
    const item = mockNotifications.find((n) => n.name === params.name)
    if (!item) {
      return HttpResponse.json({ message: "Not Found" }, { status: 404 })
    }
    return HttpResponse.json({ data: item })
  }),

  // PUT /resource/Notification Log/{name} — mark as read
  http.put("*/resource/Notification%20Log/:name", async ({ params }) => {
    await delay(200)
    const item = mockNotifications.find((n) => n.name === params.name)
    if (item) item.read = 1
    return HttpResponse.json({ data: { message: "ok" } })
  }),
]
