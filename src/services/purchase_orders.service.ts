import { apiClient } from "./api-client"

export interface PurchaseOrder {
  id: string
  number: string
  supplierId: string
  supplierName: string
  orderDate: string
  expectedDelivery: string
  total: number
  status: "draft" | "sent" | "received" | "cancelled"
  notes?: string
  createdAt: string
}

export interface PurchaseOrderListResponse {
  items: PurchaseOrder[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PurchaseOrderFormData {
  supplierName: string
  total: number
  orderDate: string
  expectedDelivery?: string
  status?: "draft" | "sent" | "received" | "cancelled"
  notes?: string
}

export const purchaseOrderService = {
  list: (params: { search?: string; page?: number; pageSize?: number; status?: string } = {}): Promise<PurchaseOrderListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    if (params.status) qs.set("status", params.status)
    return apiClient(`/purchase-orders?${qs}`)
  },
  getById: (id: string): Promise<PurchaseOrder> => apiClient(`/purchase-orders/${id}`),
  create: (data: PurchaseOrderFormData): Promise<PurchaseOrder> =>
    apiClient("/purchase-orders", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<PurchaseOrderFormData>): Promise<PurchaseOrder> =>
    apiClient(`/purchase-orders/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string): Promise<void> =>
    apiClient(`/purchase-orders/${id}`, { method: "DELETE" }),
}
