import { apiClient } from "@/services/api-client"
export type { QuotationItem, QuotationFormData, Quotation, QuotationListResponse } from "../types"

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
