import { apiClient } from "@/services/api-client"
export type { FollowUp, FollowUpListResponse } from "../types"

export const followUpService = {
  async list(params: {
    search?: string
    status?: string
    page?: number
    pageSize?: number
  }): Promise<FollowUpListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.status) qs.set("status", params.status)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<FollowUpListResponse>(`/follow-ups?${qs.toString()}`)
  },
  async getById(id: string): Promise<FollowUp> {
    return apiClient<FollowUp>(`/follow-ups/${id}`)
  },
  async create(data: Partial<FollowUp>): Promise<FollowUp> {
    return apiClient<FollowUp>("/follow-ups", { method: "POST", body: JSON.stringify(data) })
  },
  async update(id: string, data: Partial<FollowUp>): Promise<FollowUp> {
    return apiClient<FollowUp>(`/follow-ups/${id}`, { method: "PUT", body: JSON.stringify(data) })
  },
  async complete(id: string): Promise<FollowUp> {
    return apiClient<FollowUp>(`/follow-ups/${id}`, {
      method: "PUT", body: JSON.stringify({ status: "completed" }),
    })
  },
}
