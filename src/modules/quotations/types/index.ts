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
