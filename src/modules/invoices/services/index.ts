import { apiClient } from "@/services/api-client"
export type { LineItem, Invoice, InvoiceListResponse, InvoiceFormData, Product } from "../types"

export const invoiceService = {
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
    status?: string
    customerId?: string
  }): Promise<InvoiceListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    if (params.customerId) qs.set("customerId", params.customerId)
    return apiClient<InvoiceListResponse>(`/invoices?${qs.toString()}`)
  },

  async getById(id: string): Promise<Invoice> {
    return apiClient<Invoice>(`/invoices/${id}`)
  },

  async create(data: InvoiceFormData): Promise<Invoice> {
    return apiClient<Invoice>("/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<InvoiceFormData>): Promise<Invoice> {
    return apiClient<Invoice>(`/invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  async getProducts(): Promise<Product[]> {
    const result = await apiClient<{ items: Product[]; total: number }>("/products")
    return result.items
  },
}
