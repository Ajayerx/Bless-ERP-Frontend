import { apiClient } from "@/services/api-client"
import type { PurchaseOrder, PurchaseOrderListResponse, PurchaseOrderFormData } from "../types"

export const purchaseOrderService = {
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<PurchaseOrderListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<PurchaseOrderListResponse>(`/purchase-orders?${qs.toString()}`)
  },

  async getById(id: string): Promise<PurchaseOrder> {
    return apiClient<PurchaseOrder>(`/purchase-orders/${id}`)
  },

  async create(data: PurchaseOrderFormData): Promise<PurchaseOrder> {
    return apiClient<PurchaseOrder>("/purchase-orders", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<PurchaseOrderFormData>): Promise<PurchaseOrder> {
    return apiClient<PurchaseOrder>(`/purchase-orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
}
