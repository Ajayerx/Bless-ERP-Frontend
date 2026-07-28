import { apiClient } from "@/services/api-client"
export type { SalesOrderItem, SalesOrder, SalesOrderListResponse } from "../types"
import type { SalesOrder as SOType, SalesOrderListResponse, SalesOrderItem } from "../types"

interface FrappeSalesOrder {
  name: string
  customer: string
  customer_name: string
  transaction_date: string
  delivery_date: string
  status: string
  docstatus: number
  grand_total: number
  per_delivered: number
  per_billed: number
  items: Array<{
    item_name: string
    qty: number
    rate: number
    amount: number
  }>
}

function mapStatus(doc: FrappeSalesOrder): SOType["status"] {
  if (doc.docstatus === 2) return "cancelled"
  const s = (doc.status || "").toLowerCase()
  if (s === "draft" || s === "pending") return "draft"
  if (s === "completed" || s === "closed") return "completed"
  if (s === "cancelled") return "cancelled"
  return "confirmed"
}

function mapFulfillment(doc: FrappeSalesOrder): SOType["fulfillmentStatus"] {
  if (doc.docstatus === 2) return "cancelled"
  if (doc.per_delivered >= 100) return "fulfilled"
  if (doc.per_delivered > 0) return "partial"
  return "pending"
}

function mapDoc(doc: FrappeSalesOrder): SOType {
  return {
    id: doc.name,
    number: doc.name,
    customerId: doc.customer,
    customerName: doc.customer_name || doc.customer,
    issueDate: doc.transaction_date || "",
    deliveryDate: doc.delivery_date || "",
    status: mapStatus(doc),
    items: (doc.items || []).map((i) => ({
      productId: i.item_name,
      productName: i.item_name,
      qty: i.qty,
      rate: i.rate,
      amount: i.amount,
    })),
    total: doc.grand_total || 0,
    fulfillmentStatus: mapFulfillment(doc),
    createdAt: doc.transaction_date || "",
  }
}

const STATUS_MAP: Record<string, string> = {
  draft: "Draft",
  confirmed: "To Deliver and Bill",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const salesOrderService = {
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
    status?: string
  }): Promise<SalesOrderListResponse> {
    const fields = JSON.stringify([
      "name", "customer", "customer_name", "transaction_date",
      "delivery_date", "status", "docstatus", "grand_total",
      "per_delivered", "per_billed",
    ])
    const filters: unknown[][] = []
    if (params.status) {
      const mapped = STATUS_MAP[params.status]
      if (mapped) filters.push(["status", "=", mapped])
    }
    const limit = params.pageSize ?? 20
    const start = ((params.page ?? 1) - 1) * limit

    const qp = new URLSearchParams()
    qp.set("fields", fields)
    if (filters.length) qp.set("filters", JSON.stringify(filters))
    qp.set("limit_page_length", String(limit))
    qp.set("limit_start", String(start))
    if (params.search) qp.set("filters", JSON.stringify([...filters, ["customer_name", "like", `%${params.search}%`]]))

    const rows = await apiClient<FrappeSalesOrder[]>(
      `/resource/Sales%20Order?${qp.toString()}`
    )

    const countQp = new URLSearchParams()
    if (filters.length) countQp.set("filters", JSON.stringify(filters))
    countQp.set("limit_page_length", "0")
    const countRes = await apiClient<{ data?: FrappeSalesOrder[] } | FrappeSalesOrder[]>(
      `/resource/Sales%20Order?${countQp.toString()}`
    )
    const total = Array.isArray(countRes) ? countRes.length : 0

    return {
      items: (rows || []).map(mapDoc),
      total,
      page: params.page ?? 1,
      pageSize: limit,
    }
  },

  async getById(id: string): Promise<SOType> {
    const doc = await apiClient<FrappeSalesOrder>(
      `/resource/Sales%20Order/${encodeURIComponent(id)}`
    )
    return mapDoc(doc)
  },
}
