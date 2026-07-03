import { apiClient } from "@/services/api-client"

export interface SalesOrderItem {
  productId: string
  productName: string
  qty: number
  rate: number
  amount: number
}

export interface SalesOrder {
  id: string
  number: string
  customerId: string
  customerName: string
  issueDate: string
  deliveryDate: string
  status: "draft" | "confirmed" | "completed" | "cancelled"
  items: SalesOrderItem[]
  total: number
  fulfillmentStatus: "pending" | "partial" | "fulfilled" | "cancelled"
  createdAt: string
}

export interface SalesOrderListResponse {
  items: SalesOrder[]
  total: number
  page: number
  pageSize: number
}

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
