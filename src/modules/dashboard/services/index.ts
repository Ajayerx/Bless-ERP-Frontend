import { apiClient } from "@/services/api-client"
import type { KpiMetric, SalesDay, RecentInvoice, TopCustomer, InventoryAlert, RecentPayment, TodaySales, LowStockItem, CustomerActivity, DashboardData } from "../types"
export type { KpiMetric, SalesDay, RecentInvoice, TopCustomer, InventoryAlert, RecentPayment, TodaySales, LowStockItem, CustomerActivity, DashboardData }
export { todoService } from "./todo.service"
export type { TodoItem } from "./todo.service"
export { notificationService, timeAgo } from "./notification.service"
export type { NotificationItem } from "./notification.service"
export { eventService } from "./event.service"
export type { CalendarEvent } from "./event.service"

interface SalesInvoiceRow {
  name: string
  customer: string
  customer_name: string
  grand_total: number
  outstanding_amount: number
  posting_date: string
  creation: string
  status: string
}

interface PaymentEntryRow {
  name: string
  party: string
  party_name: string
  paid_amount: number
  payment_type: "Receive" | "Pay" | "Internal Transfer"
  posting_date: string
  creation: string
}

interface BinRow {
  item_code: string
  warehouse: string
  actual_qty: number
  stock_value: number
}

interface ItemRow {
  item_code: string
  item_name: string
  shelf_life_in_days?: number
}

interface BatchRow {
  name: string
  item: string
  expiry_date: string
  batch_qty: number
}

interface PurchaseOrderItemRow {
  item_code: string
  parent: string
}

const LOW_STOCK_THRESHOLD = 10
const EXPIRY_WARNING_DAYS = 30

function buildListUrl(
  doctype: string,
  params: {
    fields: string[]
    filters?: unknown[]
    limit_page_length?: number
    order_by?: string
  }
): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent(doctype)}?${qp.toString()}`
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function mapInvoiceStatus(status: string): "paid" | "partial" | "unpaid" {
  const s = status.toLowerCase()
  if (s === "paid") return "paid"
  if (s === "partly paid" || s === "partial") return "partial"
  return "unpaid"
}

async function fetchSalesInvoices(): Promise<SalesInvoiceRow[]> {
  return apiClient<SalesInvoiceRow[]>(
    buildListUrl("Sales Invoice", {
      fields: [
        "name", "customer", "customer_name", "grand_total",
        "outstanding_amount", "posting_date", "creation", "status",
      ],
      filters: [["docstatus", "=", 1]],
      order_by: "creation desc",
    })
  )
}

async function fetchPaymentEntries(): Promise<PaymentEntryRow[]> {
  return apiClient<PaymentEntryRow[]>(
    buildListUrl("Payment Entry", {
      fields: [
        "name", "party", "party_name", "paid_amount",
        "payment_type", "posting_date", "creation",
      ],
      filters: [["docstatus", "=", 1]],
      order_by: "creation desc",
    })
  )
}

async function fetchBins(): Promise<BinRow[]> {
  return apiClient<BinRow[]>(
    buildListUrl("Bin", {
      fields: ["item_code", "warehouse", "actual_qty", "stock_value"],
    })
  )
}

async function fetchItems(): Promise<ItemRow[]> {
  return apiClient<ItemRow[]>(
    buildListUrl("Item", {
      fields: ["item_code", "item_name", "shelf_life_in_days"],
    })
  )
}

async function fetchExpiringBatches(): Promise<BatchRow[]> {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + EXPIRY_WARNING_DAYS)
  return apiClient<BatchRow[]>(
    buildListUrl("Batch", {
      fields: ["name", "item", "expiry_date", "batch_qty"],
      filters: [
        ["expiry_date", "between", [isoDate(new Date()), isoDate(futureDate)]],
        ["batch_qty", ">", 0],
      ],
    })
  )
}

interface FrappePOListRow {
  name: string
}

interface FrappePurchaseOrderDoc {
  name: string
  items: { item_code: string }[]
}

// Frappe v15+ blocks direct child-table queries through the REST API
// (check_parent_permission).  Instead we list draft Purchase Orders and
// fetch each full document, which includes its child `items` table.
async function fetchPendingPurchaseItems(): Promise<PurchaseOrderItemRow[]> {
  const poNames = await apiClient<FrappePOListRow[]>(
    buildListUrl("Purchase Order", {
      fields: ["name"],
      filters: [["docstatus", "=", 0]],
    })
  )

  if (!poNames.length) return []

  const docs = await Promise.all(
    poNames.map((po) =>
      apiClient<FrappePurchaseOrderDoc>(
        `/resource/Purchase Order/${encodeURIComponent(po.name)}`,
      ).catch(() => null),
    ),
  )

  const result: PurchaseOrderItemRow[] = []
  for (const doc of docs) {
    if (!doc) continue
    for (const item of doc.items ?? []) {
      result.push({ item_code: item.item_code, parent: doc.name })
    }
  }
  return result
}

function buildKpis(
  invoices: SalesInvoiceRow[],
  payments: PaymentEntryRow[],
  bins: BinRow[]
): DashboardData["kpis"] {
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.grand_total, 0)
  const accountsReceivable = invoices.reduce(
    (sum, inv) => sum + inv.outstanding_amount, 0
  )
  const inventoryValue = bins.reduce((sum, b) => sum + (b.stock_value ?? 0), 0)

  const last7Start = daysAgo(7)
  const prev7Start = daysAgo(14)

  const revenueLast7 = invoices
    .filter((inv) => new Date(inv.posting_date) >= last7Start)
    .reduce((sum, inv) => sum + inv.grand_total, 0)
  const revenuePrev7 = invoices
    .filter(
      (inv) =>
        new Date(inv.posting_date) >= prev7Start &&
        new Date(inv.posting_date) < last7Start
    )
    .reduce((sum, inv) => sum + inv.grand_total, 0)

  const netCashFlow = (from: Date, to?: Date) =>
    payments
      .filter((p) => {
        const d = new Date(p.posting_date)
        return d >= from && (!to || d < to)
      })
      .reduce(
        (sum, p) =>
          sum + (p.payment_type === "Receive" ? p.paid_amount : -p.paid_amount),
        0
      )

  const cashFlowLast7 = netCashFlow(last7Start)
  const cashFlowPrev7 = netCashFlow(prev7Start, last7Start)

  // 7-day sparklines (oldest → newest)
  const revenueSparkline: number[] = []
  const arSparkline: number[] = []
  const cashSparkline: number[] = []
  for (let i = 6; i >= 0; i--) {
    const day = isoDate(daysAgo(i))
    revenueSparkline.push(
      invoices.filter((inv) => inv.posting_date === day).reduce((s, inv) => s + inv.grand_total, 0)
    )
    arSparkline.push(
      invoices.filter((inv) => inv.posting_date === day).reduce((s, inv) => s + inv.outstanding_amount, 0)
    )
    cashSparkline.push(
      payments
        .filter((p) => p.posting_date === day)
        .reduce((s, p) => s + (p.payment_type === "Receive" ? p.paid_amount : -p.paid_amount), 0)
    )
  }

  const inventorySparkline: number[] = []
  for (let i = 6; i >= 0; i--) {
    const day = isoDate(daysAgo(i))
    const dayInvoices = invoices.filter((inv) => inv.posting_date === day)
    const dayPayments = payments.filter((p) => p.posting_date === day)
    const dayRevenue = dayInvoices.reduce((s, inv) => s + inv.grand_total, 0)
    const dayPaymentsAmt = dayPayments.reduce(
      (s, p) => s + (p.payment_type === "Receive" ? p.paid_amount : -p.paid_amount), 0
    )
    inventorySparkline.push(Math.max(0, inventoryValue + dayRevenue - dayPaymentsAmt))
  }

  return {
    totalRevenue: {
      label: "Total Revenue",
      value: totalRevenue,
      trend: pctChange(revenueLast7, revenuePrev7),
      trendDirection: revenueLast7 >= revenuePrev7 ? "up" : "down",
      sparkline: revenueSparkline,
    },
    accountsReceivable: {
      label: "Accounts Receivable",
      value: accountsReceivable,
      trend: pctChange(
        arSparkline.slice(-1)[0] ?? 0,
        arSparkline.slice(-2, -1)[0] ?? 0
      ),
      trendDirection: (arSparkline.slice(-1)[0] ?? 0) >= (arSparkline.slice(-2, -1)[0] ?? 0) ? "up" : "down",
      sparkline: arSparkline,
    },
    inventoryValue: {
      label: "Inventory Value",
      value: inventoryValue,
      trend: pctChange(
        inventorySparkline.slice(-1)[0] ?? 0,
        inventorySparkline.slice(-2, -1)[0] ?? 0
      ),
      trendDirection: (inventorySparkline.slice(-1)[0] ?? 0) >= (inventorySparkline.slice(-2, -1)[0] ?? 0) ? "up" : "down",
      sparkline: inventorySparkline,
    },
    cashFlow: {
      label: "Cash Flow",
      value: cashFlowLast7,
      trend: pctChange(cashFlowLast7, cashFlowPrev7),
      trendDirection: cashFlowLast7 >= cashFlowPrev7 ? "up" : "down",
      sparkline: cashSparkline,
    },
  }
}

function buildSalesChart(invoices: SalesInvoiceRow[], startDate?: string, endDate?: string): SalesDay[] {
  let filtered = invoices
  if (startDate) {
    filtered = filtered.filter((inv) => inv.posting_date >= startDate)
  }
  if (endDate) {
    filtered = filtered.filter((inv) => inv.posting_date <= endDate)
  }

  const days: SalesDay[] = []
  for (let i = 13; i >= 0; i--) {
    const day = isoDate(daysAgo(i))
    const value = filtered
      .filter((inv) => inv.posting_date === day)
      .reduce((sum, inv) => sum + inv.grand_total, 0)
    days.push({ date: day, value })
  }
  return days
}

function buildRecentInvoices(invoices: SalesInvoiceRow[]): RecentInvoice[] {
  return invoices.slice(0, 5).map((inv) => ({
    id: inv.name,
    number: inv.name,
    date: inv.posting_date,
    customerName: inv.customer_name || inv.customer,
    amount: inv.grand_total,
    status: mapInvoiceStatus(inv.status),
  }))
}

function buildTopCustomers(invoices: SalesInvoiceRow[]): TopCustomer[] {
  const totals = new Map<string, number>()
  for (const inv of invoices) {
    const key = inv.customer_name || inv.customer
    totals.set(key, (totals.get(key) ?? 0) + inv.grand_total)
  }
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({
      id: name,
      name,
      amount,
    }))
}

function buildInventoryAlerts(
  bins: BinRow[],
  items: ItemRow[],
  expiringBatches: BatchRow[],
  pendingPurchaseItems: PurchaseOrderItemRow[],
): InventoryAlert[] {
  const itemNames = new Map(items.map((it) => [it.item_code, it.item_name]))
  const alerts: InventoryAlert[] = []

  // Stock-based alerts (negative, out_of_stock, low_stock, reorder_soon, overstock)
  for (const b of bins) {
    if (b.actual_qty < 0) {
      alerts.push({
        id: `${b.item_code}-${b.warehouse}-neg`,
        productName: itemNames.get(b.item_code) ?? b.item_code,
        stock: b.actual_qty,
        reorderLevel: LOW_STOCK_THRESHOLD,
        status: "negative_stock",
        color: "#7F1D1D",
      })
    } else if (b.actual_qty === 0) {
      alerts.push({
        id: `${b.item_code}-${b.warehouse}-oos`,
        productName: itemNames.get(b.item_code) ?? b.item_code,
        stock: 0,
        reorderLevel: LOW_STOCK_THRESHOLD,
        status: "out_of_stock",
        color: "#B91C1C",
      })
    } else if (b.actual_qty <= 3) {
      alerts.push({
        id: `${b.item_code}-${b.warehouse}-low`,
        productName: itemNames.get(b.item_code) ?? b.item_code,
        stock: b.actual_qty,
        reorderLevel: LOW_STOCK_THRESHOLD,
        status: "low_stock",
        color: "#DC2626",
      })
    } else if (b.actual_qty <= LOW_STOCK_THRESHOLD) {
      alerts.push({
        id: `${b.item_code}-${b.warehouse}-reorder`,
        productName: itemNames.get(b.item_code) ?? b.item_code,
        stock: b.actual_qty,
        reorderLevel: LOW_STOCK_THRESHOLD,
        status: "reorder_soon",
        color: "#F59E0B",
      })
    } else if (b.actual_qty > 100) {
      alerts.push({
        id: `${b.item_code}-${b.warehouse}-over`,
        productName: itemNames.get(b.item_code) ?? b.item_code,
        stock: b.actual_qty,
        reorderLevel: LOW_STOCK_THRESHOLD,
        status: "overstock",
        color: "#3B82F6",
      })
    }
  }

  // Expiring products
  const expiringItems = new Set(expiringBatches.map((b) => b.item))
  for (const itemCode of expiringItems) {
    alerts.push({
      id: `exp-${itemCode}`,
      productName: itemNames.get(itemCode) ?? itemCode,
      stock: 0,
      reorderLevel: 0,
      status: "expiring",
      color: "#8B5CF6",
    })
  }

  // Pending purchase
  const pendingItems = new Map<string, string[]>()
  for (const po of pendingPurchaseItems) {
    if (!pendingItems.has(po.item_code)) pendingItems.set(po.item_code, [])
    pendingItems.get(po.item_code)!.push(po.parent)
  }
  for (const itemCode of pendingItems.keys()) {
    alerts.push({
      id: `pending-${itemCode}`,
      productName: itemNames.get(itemCode) ?? itemCode,
      stock: 0,
      reorderLevel: 0,
      status: "pending_purchase",
      color: "#EA580C",
    })
  }

  return alerts
    .sort((a, b) => {
      const order: Record<string, number> = {
        negative_stock: 0,
        out_of_stock: 1,
        low_stock: 2,
        reorder_soon: 3,
        expiring: 4,
        pending_purchase: 5,
        overstock: 6,
      }
      return (order[a.status] ?? 99) - (order[b.status] ?? 99)
    })
    .slice(0, 5)
}

function buildRecentPayments(payments: PaymentEntryRow[]): RecentPayment[] {
  return payments.slice(0, 5).map((p) => ({
    id: p.name,
    number: p.name,
    date: p.posting_date,
    customerName: p.party_name || p.party,
    amount: p.paid_amount,
  }))
}

function buildTodaySales(invoices: SalesInvoiceRow[]): { amount: number; previousDayAmount: number; percentChange: number; sparkline: number[] } {
  const today = isoDate(new Date())
  const yesterday = isoDate(daysAgo(1))

  const todayTotal = invoices
    .filter((inv) => inv.posting_date === today)
    .reduce((sum, inv) => sum + inv.grand_total, 0)

  const yesterdayTotal = invoices
    .filter((inv) => inv.posting_date === yesterday)
    .reduce((sum, inv) => sum + inv.grand_total, 0)

  const pct = yesterdayTotal === 0
    ? (todayTotal === 0 ? 0 : 100)
    : Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 1000) / 10

  const sparkline: number[] = []
  for (let i = 6; i >= 0; i--) {
    const day = isoDate(daysAgo(i))
    sparkline.push(
      invoices.filter((inv) => inv.posting_date === day).reduce((sum, inv) => sum + inv.grand_total, 0)
    )
  }

  return { amount: todayTotal, previousDayAmount: yesterdayTotal, percentChange: pct, sparkline }
}

function buildLowStockItems(bins: BinRow[], items: ItemRow[]): { id: string; productName: string; stock: number; reorderLevel: number }[] {
  const itemNames = new Map(items.map((it) => [it.item_code, it.item_name]))
  return bins
    .filter((b) => b.actual_qty <= LOW_STOCK_THRESHOLD && b.actual_qty >= 0)
    .sort((a, b) => a.actual_qty - b.actual_qty)
    .slice(0, 5)
    .map((b) => ({
      id: `${b.item_code}-${b.warehouse}`,
      productName: itemNames.get(b.item_code) ?? b.item_code,
      stock: b.actual_qty,
      reorderLevel: LOW_STOCK_THRESHOLD,
    }))
}

function buildActivities(invoices: SalesInvoiceRow[], payments: PaymentEntryRow[]): { id: string; customer: string; action: string; target: string; amount: number; date: string }[] {
  const activities: { id: string; customer: string; action: string; target: string; amount: number; date: string }[] = []

  for (const inv of invoices.slice(0, 3)) {
    activities.push({
      id: `inv-${inv.name}`,
      customer: inv.customer_name || inv.customer,
      action: "created invoice",
      target: inv.name,
      amount: inv.grand_total,
      date: inv.posting_date,
    })
  }

  for (const p of payments.slice(0, 3)) {
    activities.push({
      id: `pay-${p.name}`,
      customer: p.party_name || p.party,
      action: "made payment",
      target: p.name,
      amount: p.paid_amount,
      date: p.posting_date,
    })
  }

  return activities
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
}

export const dashboardService = {
  async get(startDate?: string, endDate?: string): Promise<DashboardData> {
    const [invoices, payments, bins, items, batches, pendingPOs] = await Promise.all([
      fetchSalesInvoices().catch(() => [] as SalesInvoiceRow[]),
      fetchPaymentEntries().catch(() => [] as PaymentEntryRow[]),
      fetchBins().catch(() => [] as BinRow[]),
      fetchItems().catch(() => [] as ItemRow[]),
      fetchExpiringBatches().catch(() => [] as BatchRow[]),
      fetchPendingPurchaseItems().catch(() => [] as PurchaseOrderItemRow[]),
    ])

    return {
      kpis: buildKpis(invoices, payments, bins),
      salesChart: buildSalesChart(invoices, startDate, endDate),
      recentInvoices: buildRecentInvoices(invoices),
      topCustomers: buildTopCustomers(invoices),
      inventoryAlerts: buildInventoryAlerts(bins, items, batches, pendingPOs),
      recentPayments: buildRecentPayments(payments),
      todaySales: buildTodaySales(invoices),
      lowStockItems: buildLowStockItems(bins, items),
      activities: buildActivities(invoices, payments),
    }
  },
}
