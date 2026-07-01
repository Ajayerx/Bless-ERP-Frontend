import { apiClient } from "./api-client"

export interface Contact {
  id: string
  customerId: string
  name: string
  email: string
  phone: string
  role: string
  isPrimary: boolean
  notes: string
  createdAt: string
}

export interface ContactListResponse {
  items: Contact[]
  total: number
}

export interface ContactFormData {
  customerId: string
  name: string
  email: string
  phone: string
  role: string
  isPrimary: boolean
  notes: string
}

export const contactService = {
  list: (params: { search?: string; page?: number; customerId?: string } = {}): Promise<ContactListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.customerId) qs.set("customerId", params.customerId)
    return apiClient(`/contacts?${qs}`)
  },

  getById: (id: string): Promise<Contact> => {
    return apiClient(`/contacts/${id}`)
  },

  create: (data: ContactFormData): Promise<Contact> => {
    return apiClient("/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (id: string, data: Partial<ContactFormData>): Promise<Contact> => {
    return apiClient(`/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (id: string): Promise<void> => {
    return apiClient(`/contacts/${id}`, { method: "DELETE" })
  },
}
