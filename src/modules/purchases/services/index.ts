import { apiClient } from "@/services/api-client"
import type {
  PurchaseOrder, PurchaseOrderListResponse, PurchaseOrderFormData,
  Vendor, VendorListResponse, VendorFormData,
  Bill, BillListResponse, BillFormData,
} from "../types"

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

export const vendorService = {
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<VendorListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<VendorListResponse>(`/vendors?${qs.toString()}`)
  },

  async getById(id: string): Promise<Vendor> {
    return apiClient<Vendor>(`/vendors/${id}`)
  },

  async create(data: VendorFormData): Promise<Vendor> {
    return apiClient<Vendor>("/vendors", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<VendorFormData>): Promise<Vendor> {
    return apiClient<Vendor>(`/vendors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
}

export const billService = {
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<BillListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<BillListResponse>(`/bills?${qs.toString()}`)
  },

  async getById(id: string): Promise<Bill> {
    return apiClient<Bill>(`/bills/${id}`)
  },

  async create(data: BillFormData): Promise<Bill> {
    return apiClient<Bill>("/bills", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<BillFormData & { status: Bill["status"] }>): Promise<Bill> {
    return apiClient<Bill>(`/bills/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
}
