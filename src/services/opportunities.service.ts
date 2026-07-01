import { apiClient } from "./api-client"

export type OpportunityStage = "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost"

export interface Opportunity {
  id: string
  title: string
  customerId: string
  customerName: string
  value: number
  stage: OpportunityStage
  probability: number
  expectedClose: string
  assignedTo: string
  notes: string
  createdAt: string
}

export interface OpportunityListResponse {
  items: Opportunity[]
  total: number
}

export interface OpportunityFormData {
  title: string
  customerId: string
  customerName: string
  value: number
  stage: OpportunityStage
  probability: number
  expectedClose: string
  assignedTo: string
  notes: string
}

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
