import { apiClient } from "@/services/api-client"
import type { Supplier, SupplierListResponse, SupplierFormData } from "../types"
export type { Supplier, SupplierListResponse, SupplierFormData }

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
