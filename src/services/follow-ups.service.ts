import { apiClient } from "./api-client"

export interface FollowUp {
  id: string
  title: string
  description: string
  relatedType: string
  relatedId: string
  relatedName: string
  dueDate: string
  status: string
  priority: string
  assignedTo: string
  createdAt: string
}

export interface FollowUpListResponse {
  items: FollowUp[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const followUpService = {
  list: (params: { search?: string; page?: number; pageSize?: number; status?: string } = {}): Promise<FollowUpListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    if (params.status) qs.set("status", params.status)
    return apiClient(`/follow-ups?${qs}`)
  },
  getById: (id: string): Promise<FollowUp> => apiClient(`/follow-ups/${id}`),
  complete: (id: string): Promise<FollowUp> =>
    apiClient(`/follow-ups/${id}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) }),
}
