import { apiClient } from "./api-client"

export interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  source: string
  status: string
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

export interface LeadFormData {
  firstName: string
  lastName: string
  email: string
  phone?: string
  company?: string
  source?: string
  status?: string
  estimatedValue?: number
  notes?: string
  assignedTo?: string
}

export const leadService = {
  list: (params: { search?: string; page?: number; pageSize?: number } = {}): Promise<LeadListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient(`/leads?${qs}`)
  },
  getById: (id: string): Promise<Lead> => apiClient(`/leads/${id}`),
  create: (data: LeadFormData): Promise<Lead> =>
    apiClient("/leads", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<LeadFormData>): Promise<Lead> =>
    apiClient(`/leads/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string): Promise<void> =>
    apiClient(`/leads/${id}`, { method: "DELETE" }),
}
