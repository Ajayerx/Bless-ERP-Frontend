import type { LineItem } from "@/services/invoices.service"

export type PurchaseOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled"

export interface PurchaseOrder {
  id: string
  number: string
  vendorId: string
  vendorName: string
  vendorContact: string
  billTo: string
  shippingAddress: string
  issueDate: string
  deliveryDate: string
  status: PurchaseOrderStatus
  lineItems: LineItem[]
  subtotal: number
  gst: number
  qst: number
  total: number
  notes: string
  createdAt: string
}

export interface PurchaseOrderListResponse {
  items: PurchaseOrder[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PurchaseOrderFormData {
  vendorId: string
  vendorName: string
  vendorContact: string
  billTo: string
  shippingAddress: string
  issueDate: string
  deliveryDate: string
  lineItems: Omit<LineItem, "id">[]
  subtotal: number
  gst: number
  qst: number
  total: number
  notes: string
}

export interface Vendor {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  billingAddress: string
  shippingAddress: string
  status: "active" | "inactive"
}
