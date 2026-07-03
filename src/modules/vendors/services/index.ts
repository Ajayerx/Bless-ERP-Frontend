import { apiClient } from "@/services/api-client"

export interface Vendor {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  billingAddress: string
  taxId: string
  balance: number
  status: "active" | "inactive"
  createdAt: string
}

export interface VendorListResponse {
  items: Vendor[]
  total: number
  page: number
  pageSize: number
}

export interface VendorFormData {
  name: string
  contactName: string
  email: string
  phone: string
  billingAddress: string
  taxId: string
}

export const vendorService = {
  list: (params: { search?: string; page?: number; pageSize?: number }): Promise<VendorListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient(`/vendors?${qs}`)
  },
  getById: (id: string): Promise<Vendor> => apiClient(`/vendors/${id}`),
  create: (data: VendorFormData): Promise<Vendor> =>
    apiClient("/vendors", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<VendorFormData>): Promise<Vendor> =>
    apiClient(`/vendors/${id}`, { method: "PUT", body: JSON.stringify(data) }),
}
