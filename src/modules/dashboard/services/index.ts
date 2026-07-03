import { apiClient } from "@/services/api-client"

export interface KpiMetric {
  label: string
  value: number
  currency?: string
  trend: number
  trendDirection: "up" | "down" | "neutral"
  sparkline: number[]
}

export interface SalesDay {
  date: string
  value: number
}

export interface RecentInvoice {
  id: string
  number: string
  date: string
  customerName: string
  amount: number
  status: "paid" | "partial" | "unpaid"
}

export interface TopCustomer {
  id: string
  name: string
  amount: number
  initial: string
  color: string
}

export interface InventoryAlert {
  id: string
  productName: string
  stock: number
  reorderLevel: number
  status: "low_stock" | "reorder_soon"
  color: string
}

export interface RecentPayment {
  id: string
  number: string
  date: string
  customerName: string
  amount: number
}

export interface DashboardData {
  kpis: {
    totalRevenue: KpiMetric
    accountsReceivable: KpiMetric
    inventoryValue: KpiMetric
    cashFlow: KpiMetric
  }
  salesChart: SalesDay[]
  recentInvoices: RecentInvoice[]
  topCustomers: TopCustomer[]
  inventoryAlerts: InventoryAlert[]
  recentPayments: RecentPayment[]
}

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
}

const LOW_STOCK_THRESHOLD = 10

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

const CUSTOMER_COLORS = ["#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#DC2626"]

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
      fields: ["item_code", "item_name"],
    })
  )
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

  const sparkline: number[] = []
  for (let i = 6; i >= 0; i--) {
    const day = isoDate(daysAgo(i))
    const dayTotal = invoices
      .filter((inv) => inv.posting_date === day)
      .reduce((sum, inv) => sum + inv.grand_total, 0)
    sparkline.push(dayTotal)
  }

  return {
    totalRevenue: {
      label: "Total Revenue",
      value: totalRevenue,
      trend: pctChange(revenueLast7, revenuePrev7),
      trendDirection: revenueLast7 >= revenuePrev7 ? "up" : "down",
      sparkline,
    },
    accountsReceivable: {
      label: "Accounts Receivable",
      value: accountsReceivable,
      trend: 0,
      trendDirection: "neutral",
      sparkline: [],
    },
    inventoryValue: {
      label: "Inventory Value",
      value: inventoryValue,
      trend: 0,
      trendDirection: "neutral",
      sparkline: [],
    },
    cashFlow: {
      label: "Cash Flow",
      value: cashFlowLast7,
      trend: pctChange(cashFlowLast7, cashFlowPrev7),
      trendDirection: cashFlowLast7 >= cashFlowPrev7 ? "up" : "down",
      sparkline: [],
    },
  }
}

function buildSalesChart(invoices: SalesInvoiceRow[]): SalesDay[] {
  const days: SalesDay[] = []
  for (let i = 13; i >= 0; i--) {
    const day = isoDate(daysAgo(i))
    const value = invoices
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
    .map(([name, amount], i) => ({
      id: name,
      name,
      amount,
      initial: name.charAt(0).toUpperCase(),
      color: CUSTOMER_COLORS[i % CUSTOMER_COLORS.length],
    }))
}

function buildInventoryAlerts(
  bins: BinRow[],
  items: ItemRow[]
): InventoryAlert[] {
  const itemNames = new Map(items.map((it) => [it.item_code, it.item_name]))
  return bins
    .filter((b) => b.actual_qty <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.actual_qty - b.actual_qty)
    .slice(0, 10)
    .map((b) => ({
      id: `${b.item_code}-${b.warehouse}`,
      productName: itemNames.get(b.item_code) ?? b.item_code,
      stock: b.actual_qty,
      reorderLevel: LOW_STOCK_THRESHOLD,
      status: b.actual_qty <= 0 ? "low_stock" : "reorder_soon",
      color: b.actual_qty <= 0 ? "#DC2626" : "#F59E0B",
    }))
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

export const dashboardService = {
  async get(): Promise<DashboardData> {
    const [invoices, payments, bins, items] = await Promise.all([
      fetchSalesInvoices(),
      fetchPaymentEntries(),
      fetchBins(),
      fetchItems(),
    ])

    return {
      kpis: buildKpis(invoices, payments, bins),
      salesChart: buildSalesChart(invoices),
      recentInvoices: buildRecentInvoices(invoices),
      topCustomers: buildTopCustomers(invoices),
      inventoryAlerts: buildInventoryAlerts(bins, items),
      recentPayments: buildRecentPayments(payments),
    }
  },
}
