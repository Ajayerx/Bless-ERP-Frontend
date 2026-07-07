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
