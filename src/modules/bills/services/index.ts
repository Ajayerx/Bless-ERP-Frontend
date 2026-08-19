import { apiClient } from "@/services/api-client"
import type { Bill, BillListResponse, BillFormData } from "../types"
export type { Bill, BillListResponse, BillFormData }

export const billService = {
  list: (params: { search?: string; page?: number; pageSize?: number; status?: string } = {}): Promise<BillListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    if (params.status) qs.set("status", params.status)
    return apiClient(`/bills?${qs}`)
  },
  getById: (id: string): Promise<Bill> => apiClient(`/bills/${id}`),
  create: (data: BillFormData): Promise<Bill> =>
    apiClient("/bills", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<BillFormData>): Promise<Bill> =>
    apiClient(`/bills/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string): Promise<void> =>
    apiClient(`/bills/${id}`, { method: "DELETE" }),
}
