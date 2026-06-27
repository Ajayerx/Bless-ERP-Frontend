import { apiClient } from "./api-client"
import type { LineItem } from "./invoices.service"

export interface Quotation {
  id: string
  number: string
  customerId: string
  customerName: string
  customerContact: string
  billTo: string
  issueDate: string
  validUntil: string
  status: "draft" | "sent" | "accepted" | "rejected" | "expired"
  lineItems: LineItem[]
  subtotal: number
  gst: number
  qst: number
  total: number
  notes: string
  createdAt: string
}

export interface QuotationListResponse {
  items: Quotation[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface QuotationFormData {
  customerId: string
  customerName: string
  customerContact: string
  billTo: string
  issueDate: string
  validUntil: string
  lineItems: Omit<LineItem, "id">[]
  subtotal: number
  gst: number
  qst: number
  total: number
  notes: string
}

export const quotationService = {
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<QuotationListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<QuotationListResponse>(`/quotations?${qs.toString()}`)
  },

  async getById(id: string): Promise<Quotation> {
    return apiClient<Quotation>(`/quotations/${id}`)
  },

  async create(data: QuotationFormData): Promise<Quotation> {
    return apiClient<Quotation>("/quotations", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<QuotationFormData>): Promise<Quotation> {
    return apiClient<Quotation>(`/quotations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
}
