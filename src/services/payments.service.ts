import { apiClient } from "./api-client"
import type { Invoice } from "./invoices.service"

export type PaymentMethod =
  | "cash"
  | "interac"
  | "e_transfer"
  | "check"
  | "bank_transfer"
  | "credit_card"
  | "on_account"

export interface Payment {
  id: string
  invoiceId: string
  invoiceNumber: string
  customerName: string
  amount: number
  paymentDate: string
  paymentMethod: PaymentMethod
  reference: string
  referenceNumber?: string
  notes: string
  createdAt: string
}

export interface PaymentListResponse {
  items: Payment[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface RecordPaymentData {
  invoiceId: string
  invoiceNumber: string
  customerName: string
  amount: number
  paymentDate: string
  paymentMethod: PaymentMethod
  reference: string
  notes: string
}

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