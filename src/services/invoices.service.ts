import { apiClient } from "./api-client"

export interface LineItem {
  id: string
  productId: string
  productName: string
  sku: string
  quantity: number
  price: number
  taxRate: number
  taxLabel: string
  total: number
}

export interface Invoice {
  id: string
  number: string
  customerId: string
  customerName: string
  billTo: string
  issueDate: string
  dueDate: string
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
  lineItems: LineItem[]
  subtotal: number
  gst: number
  qst: number
  total: number
  createdAt: string
}

export interface InvoiceListResponse {
  items: Invoice[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface InvoiceFormData {
  customerId: string
  customerName: string
  billTo: string
  issueDate: string
  dueDate: string
  lineItems: Omit<LineItem, "id">[]
  subtotal: number
  gst: number
  qst: number
  total: number
}

export interface Product {
  id: string
  sku: string
  name: string
  category?: string
  price: number
  cost?: number
  costPrice?: number
  stock: number
  unit: string
  description?: string
  warehouse?: string
  taxable?: boolean
  reorderLevel?: number
}

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
