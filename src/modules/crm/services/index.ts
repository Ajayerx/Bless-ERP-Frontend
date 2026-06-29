import { apiClient } from "@/services/api-client"
import type {
  Contact,
  ContactListResponse,
  Lead,
  LeadListResponse,
  Opportunity,
  OpportunityListResponse,
  FollowUp,
  FollowUpListResponse,
} from "../types"

export const contactService = {
  async list(params: { search?: string; page?: number; pageSize?: number }): Promise<ContactListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<ContactListResponse>(`/contacts?${qs.toString()}`)
  },
  async getById(id: string): Promise<Contact> {
    return apiClient<Contact>(`/contacts/${id}`)
  },
  async create(data: Partial<Contact>): Promise<Contact> {
    return apiClient<Contact>("/contacts", { method: "POST", body: JSON.stringify(data) })
  },
  async update(id: string, data: Partial<Contact>): Promise<Contact> {
    return apiClient<Contact>(`/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) })
  },
  async delete(id: string): Promise<void> {
    return apiClient<void>(`/contacts/${id}`, { method: "DELETE" })
  },
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

export const opportunityService = {
  async list(params: { search?: string; page?: number; pageSize?: number }): Promise<OpportunityListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<OpportunityListResponse>(`/opportunities?${qs.toString()}`)
  },
  async getById(id: string): Promise<Opportunity> {
    return apiClient<Opportunity>(`/opportunities/${id}`)
  },
  async create(data: Partial<Opportunity>): Promise<Opportunity> {
    return apiClient<Opportunity>("/opportunities", { method: "POST", body: JSON.stringify(data) })
  },
  async update(id: string, data: Partial<Opportunity>): Promise<Opportunity> {
    return apiClient<Opportunity>(`/opportunities/${id}`, { method: "PUT", body: JSON.stringify(data) })
  },
  async delete(id: string): Promise<void> {
    return apiClient<void>(`/opportunities/${id}`, { method: "DELETE" })
  },
}

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
