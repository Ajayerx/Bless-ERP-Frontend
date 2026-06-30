import { apiClient } from "./api-client"

export interface QuotationItem {
  productId: string
  productName: string
  qty: number
  rate: number
  amount: number
}

export interface QuotationFormData {
  customerId: string
  customerName: string
  issueDate: string
  validUntil: string
  items: Omit<QuotationItem, "id">[]
  subtotal: number
  gst: number
  qst: number
  total: number
  notes: string
}

export interface Quotation {
  id: string
  number: string
  customerId: string
  customerName: string
  issueDate: string
  validUntil: string
  status: "draft" | "sent" | "accepted" | "declined" | "converted"
  items: QuotationItem[]
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
}

export const quotationService = {
  list: (params: { search?: string; page?: number; pageSize?: number; status?: string } = {}): Promise<QuotationListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    if (params.status) qs.set("status", params.status)
    return apiClient(`/quotations?${qs}`)
  },
  getById: (id: string): Promise<Quotation> => apiClient(`/quotations/${id}`),
  create: (data: QuotationFormData): Promise<Quotation> =>
    apiClient("/quotations", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<QuotationFormData>): Promise<Quotation> =>
    apiClient(`/quotations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string): Promise<void> =>
    apiClient(`/quotations/${id}`, { method: "DELETE" }),
}
