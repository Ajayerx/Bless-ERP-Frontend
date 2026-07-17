import { apiClient } from "@/services/api-client"

export interface TodoItem {
  name: string
  description: string
  status: "Open" | "Closed" | "Cancelled"
  priority: "Low" | "Medium" | "High" | "Urgent"
  date: string
  assigned_to: string
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
  return `/resource/ToDo?${qp.toString()}`
}

export const todoService = {
  async getOpenTasks(): Promise<TodoItem[]> {
    return apiClient<TodoItem[]>(
      buildListUrl({
        fields: ["name", "description", "status", "priority", "date", "assigned_to"],
        filters: [["status", "=", "Open"]],
        order_by: "date asc",
        limit_page_length: 10,
      })
    )
  },

  async toggleStatus(id: string, currentStatus: "Open" | "Closed"): Promise<TodoItem> {
    const newStatus = currentStatus === "Open" ? "Closed" : "Open"
    return apiClient<TodoItem>(`/resource/ToDo/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ status: newStatus }),
    })
  },
}
