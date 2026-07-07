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
