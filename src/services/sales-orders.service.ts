import { apiClient } from "./api-client"
import type { LineItem } from "./invoices.service"

export interface SalesOrder {
  id: string
  number: string
  customerId: string
  customerName: string
  customerContact: string
  billTo: string
  shippingAddress: string
  issueDate: string
  deliveryDate: string
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled"
  lineItems: LineItem[]
  subtotal: number
  gst: number
  qst: number
  total: number
  notes: string
  createdAt: string
}

export interface SalesOrderListResponse {
  items: SalesOrder[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SalesOrderFormData {
  customerId: string
  customerName: string
  customerContact: string
  billTo: string
  shippingAddress: string
  issueDate: string
  deliveryDate: string
  lineItems: Omit<LineItem, "id">[]
  subtotal: number
  gst: number
  qst: number
  total: number
  notes: string
}

export const salesOrderService = {
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<SalesOrderListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<SalesOrderListResponse>(`/sales-orders?${qs.toString()}`)
  },

  async getById(id: string): Promise<SalesOrder> {
    return apiClient<SalesOrder>(`/sales-orders/${id}`)
  },

  async create(data: SalesOrderFormData): Promise<SalesOrder> {
    return apiClient<SalesOrder>("/sales-orders", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<SalesOrderFormData>): Promise<SalesOrder> {
    return apiClient<SalesOrder>(`/sales-orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
}
