import { apiClient } from "@/services/api-client"

export interface Supplier {
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

export interface SupplierListResponse {
  items: Supplier[]
  total: number
  page: number
  pageSize: number
}

export interface SupplierFormData {
  name: string
  contactName: string
  email: string
  phone: string
  billingAddress: string
  taxId: string
}

export const supplierService = {
  list: (params: { search?: string; page?: number; pageSize?: number }): Promise<SupplierListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient(`/suppliers?${qs}`)
  },
  getById: (id: string): Promise<Supplier> => apiClient(`/suppliers/${id}`),
  create: (data: SupplierFormData): Promise<Supplier> =>
    apiClient("/suppliers", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SupplierFormData>): Promise<Supplier> =>
    apiClient(`/suppliers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
}
