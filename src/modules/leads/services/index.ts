import { apiClient } from "@/services/api-client"

export interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  source: "website" | "referral" | "cold_call" | "social_media" | "event" | "other"
  status: "new" | "contacted" | "qualified" | "proposal" | "lost"
  estimatedValue: number
  notes: string
  assignedTo: string
  createdAt: string
}

export interface LeadListResponse {
  items: Lead[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const leadService = {
  async list(params: { search?: string; page?: number; pageSize?: number }): Promise<LeadListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<LeadListResponse>(`/leads?${qs.toString()}`)
  },
  async getById(id: string): Promise<Lead> {
    return apiClient<Lead>(`/leads/${id}`)
  },
  async create(data: Partial<Lead>): Promise<Lead> {
    return apiClient<Lead>("/leads", { method: "POST", body: JSON.stringify(data) })
  },
  async update(id: string, data: Partial<Lead>): Promise<Lead> {
    return apiClient<Lead>(`/leads/${id}`, { method: "PUT", body: JSON.stringify(data) })
  },
  async delete(id: string): Promise<void> {
    return apiClient<void>(`/leads/${id}`, { method: "DELETE" })
  },
}
