import { apiClient } from "@/services/api-client"
export type { OpportunityStage, Opportunity, OpportunityListResponse, OpportunityFormData } from "../types"

export const opportunityService = {
  list: (params: { search?: string; page?: number } = {}): Promise<OpportunityListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    return apiClient(`/opportunities?${qs}`)
  },

  getById: (id: string): Promise<Opportunity> => {
    return apiClient(`/opportunities/${id}`)
  },

  create: (data: OpportunityFormData): Promise<Opportunity> => {
    return apiClient("/opportunities", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (id: string, data: Partial<OpportunityFormData>): Promise<Opportunity> => {
    return apiClient(`/opportunities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (id: string): Promise<void> => {
    return apiClient(`/opportunities/${id}`, { method: "DELETE" })
  },
}
