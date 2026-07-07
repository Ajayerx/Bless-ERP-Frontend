import { apiClient } from "@/services/api-client"
import type { Invoice } from "@/modules/invoices/services"
export type { PaymentMethod, Payment, PaymentListResponse, RecordPaymentData } from "../types"

export const paymentService = {
  async list(params: {
    page?: number
    pageSize?: number
  }): Promise<PaymentListResponse> {
    const qs = new URLSearchParams()
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<PaymentListResponse>(`/payments?${qs.toString()}`)
  },

  async getById(id: string): Promise<Payment> {
    return apiClient<Payment>(`/payments/${id}`)
  },

  async getUnpaidInvoices(): Promise<Invoice[]> {
    return apiClient<Invoice[]>("/invoices/unpaid")
  },

  async record(data: RecordPaymentData): Promise<Payment> {
    return apiClient<Payment>("/payments", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },
}
