import { apiClient } from "./api-client"

export interface Customer {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  billingAddress: string
  shippingAddress: string
  taxId: string
  creditLimit: number
  outstanding: number
  status: "active" | "inactive"
  createdAt: string
}

export interface CustomerListResponse {
  items: Customer[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CustomerFormData {
  name: string
  contactName: string
  email: string
  phone: string
  billingAddress: string
  shippingAddress: string
  taxId: string
  creditLimit: number
}

export const customerService = {
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<CustomerListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<CustomerListResponse>(`/customers?${qs.toString()}`)
  },

  async getById(id: string): Promise<Customer> {
    return apiClient<Customer>(`/customers/${id}`)
  },

  async create(data: CustomerFormData): Promise<Customer> {
    return apiClient<Customer>("/customers", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<CustomerFormData>): Promise<Customer> {
    return apiClient<Customer>(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/customers/${id}`, { method: "DELETE" })
  },
}
