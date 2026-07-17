import { apiClient } from "@/services/api-client"

export interface CalendarEvent {
  name: string
  subject: string
  starts_on: string
  ends_on: string
  event_type: string
  description: string
}

function buildListUrl(params: {
  fields: string[]
  filters?: unknown[]
  limit_page_length?: number
  order_by?: string
}): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/Event?${qp.toString()}`
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export const eventService = {
  async getTodayEvents(): Promise<CalendarEvent[]> {
    const today = isoDate(new Date())
    return apiClient<CalendarEvent[]>(
      buildListUrl({
        fields: ["name", "subject", "starts_on", "ends_on", "event_type", "description"],
        filters: [["starts_on", "between", [`${today} 00:00:00`, `${today} 23:59:59`]]],
        order_by: "starts_on asc",
        limit_page_length: 10,
      })
    )
  },
}
