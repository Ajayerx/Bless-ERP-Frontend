import { apiClient } from "@/services/api-client"
export type { SalesOrderItem, SalesOrder, SalesOrderListResponse } from "../types"

export const salesOrderService = {
  list: (params: { search?: string; page?: number; pageSize?: number; status?: string }): Promise<SalesOrderListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    if (params.status) qs.set("status", params.status)
    return apiClient(`/sales-orders?${qs}`)
  },
  getById: (id: string): Promise<SalesOrder> => apiClient(`/sales-orders/${id}`),
}
