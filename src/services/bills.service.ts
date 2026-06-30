import { apiClient } from "./api-client"

export interface Bill {
  id: string
  supplierId: string
  supplierName: string
  number: string
  amount: number
  issueDate: string
  dueDate: string
  status: "received" | "paid" | "overdue"
  category: string
  notes: string
  createdAt: string
}

export interface BillListResponse {
  items: Bill[]
  total: number
  page: number
  pageSize: number
}

export interface BillFormData {
  supplierName: string
  amount: number
  issueDate: string
  dueDate: string
  status?: "received" | "paid" | "overdue"
  category?: string
  notes?: string
}

export const billService = {
  list: (params: { search?: string; page?: number; pageSize?: number; status?: string } = {}): Promise<BillListResponse> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    if (params.status) qs.set("status", params.status)
    return apiClient(`/bills?${qs}`)
  },
  getById: (id: string): Promise<Bill> => apiClient(`/bills/${id}`),
  create: (data: BillFormData): Promise<Bill> =>
    apiClient("/bills", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<BillFormData>): Promise<Bill> =>
    apiClient(`/bills/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string): Promise<void> =>
    apiClient(`/bills/${id}`, { method: "DELETE" }),
}
