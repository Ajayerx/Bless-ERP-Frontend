export interface SalesOrderItem {
  productId: string
  productName: string
  qty: number
  rate: number
  amount: number
}

export interface SalesOrder {
  id: string
  number: string
  customerId: string
  customerName: string
  issueDate: string
  deliveryDate: string
  status: "draft" | "confirmed" | "completed" | "cancelled"
  items: SalesOrderItem[]
  total: number
  fulfillmentStatus: "pending" | "partial" | "fulfilled" | "cancelled"
  createdAt: string
}

export interface SalesOrderListResponse {
  items: SalesOrder[]
  total: number
  page: number
  pageSize: number
}
