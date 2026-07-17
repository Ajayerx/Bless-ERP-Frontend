import { apiClient } from "./api-client"

export interface SearchResult {
  id: string
  label: string
  description?: string
  type: "customer" | "product" | "invoice" | "payment" | "sales_order" | "warehouse" | "supplier" | "command"
  route: string
}

export interface SearchCommand {
  id: string
  label: string
  description: string
  type: "command"
  route: string
  icon: string
}

const RECENT_SEARCHES_KEY = "blesserp_recent_searches"
const MAX_RECENT = 5

const COMMANDS: SearchCommand[] = [
  { id: "cmd-invoice-new", label: "New Invoice", description: "Create a new sales invoice", type: "command", route: "/invoices/new", icon: "FileText" },
  { id: "cmd-payment-record", label: "Record Payment", description: "Record a new payment entry", type: "command", route: "/payments/new", icon: "CreditCard" },
  { id: "cmd-customer-new", label: "New Customer", description: "Add a new customer", type: "command", route: "/customers/new", icon: "Users" },
  { id: "cmd-product-new", label: "New Product", description: "Add a new product/item", type: "command", route: "/products/new", icon: "Package" },
  { id: "cmd-sales-order-new", label: "New Sales Order", description: "Create a new sales order", type: "command", route: "/sales-orders/new", icon: "ShoppingBag" },
  { id: "cmd-dashboard", label: "Go to Dashboard", description: "Navigate to dashboard", type: "command", route: "/dashboard", icon: "LayoutDashboard" },
  { id: "cmd-reports", label: "Go to Reports", description: "Navigate to reports", type: "command", route: "/reports", icon: "BarChart3" },
]

function buildListUrl(doctype: string, fields: string[], filters?: unknown[]): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(fields))
  if (filters) qp.set("filters", JSON.stringify(filters))
  qp.set("limit_page_length", "10")
  return `/resource/${encodeURIComponent(doctype)}?${qp.toString()}`
}

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addRecentSearch(query: string): void {
  const trimmed = query.trim()
  if (!trimmed) return
  const recent = getRecentSearches().filter((r) => r.toLowerCase() !== trimmed.toLowerCase())
  recent.unshift(trimmed)
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent))
}

export function clearRecentSearches(): void {
  localStorage.removeItem(RECENT_SEARCHES_KEY)
}

export const searchService = {
  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return []

    const trimmed = query.trim()

    // Command mode: starts with "/"
    if (trimmed.startsWith("/")) {
      const cmdQuery = trimmed.slice(1).toLowerCase()
      if (!cmdQuery) {
        // Show all commands when just "/" is typed
        return COMMANDS.map((c) => ({ ...c }))
      }
      return COMMANDS.filter(
        (c) => c.label.toLowerCase().includes(cmdQuery) || c.description.toLowerCase().includes(cmdQuery),
      ).map((c) => ({ ...c }))
    }

    const lower = trimmed.toLowerCase()
    const results: SearchResult[] = []

    try {
      const [customers, products, invoices, payments, salesOrders, warehouses, suppliers] = await Promise.allSettled([
        apiClient<{ name: string; customer_name: string }[]>(
          buildListUrl("Customer", ["name", "customer_name"], [["customer_name", "like", `%${lower}%`]])
        ),
        apiClient<{ item_code: string; item_name: string }[]>(
          buildListUrl("Item", ["item_code", "item_name"], [["item_name", "like", `%${lower}%`]])
        ),
        apiClient<{ name: string; title: string }[]>(
          buildListUrl("Sales Invoice", ["name", "title"], [["title", "like", `%${lower}%`]])
        ),
        apiClient<{ name: string; party_name: string }[]>(
          buildListUrl("Payment Entry", ["name", "party_name"], [["party_name", "like", `%${lower}%`]])
        ),
        apiClient<{ name: string; title: string }[]>(
          buildListUrl("Sales Order", ["name", "title"], [["title", "like", `%${lower}%`]])
        ),
        apiClient<{ name: string; warehouse_name: string }[]>(
          buildListUrl("Warehouse", ["name", "warehouse_name"], [["warehouse_name", "like", `%${lower}%`]])
        ),
        apiClient<{ name: string; supplier_name: string }[]>(
          buildListUrl("Supplier", ["name", "supplier_name"], [["supplier_name", "like", `%${lower}%`]])
        ),
      ])

      if (customers.status === "fulfilled") {
        for (const c of customers.value) {
          results.push({ id: c.name, label: c.customer_name || c.name, type: "customer", route: `/customers/${c.name}` })
        }
      }
      if (products.status === "fulfilled") {
        for (const p of products.value) {
          results.push({ id: p.item_code, label: p.item_name || p.item_code, type: "product", route: `/products/${p.item_code}` })
        }
      }
      if (invoices.status === "fulfilled") {
        for (const inv of invoices.value) {
          results.push({ id: inv.name, label: inv.title || inv.name, type: "invoice", route: `/invoices/${inv.name}` })
        }
      }
      if (payments.status === "fulfilled") {
        for (const p of payments.value) {
          results.push({ id: p.name, label: p.party_name || p.name, type: "payment", route: `/payments/${p.name}` })
        }
      }
      if (salesOrders.status === "fulfilled") {
        for (const so of salesOrders.value) {
          results.push({ id: so.name, label: so.title || so.name, type: "sales_order", route: `/sales-orders/${so.name}` })
        }
      }
      if (warehouses.status === "fulfilled") {
        for (const w of warehouses.value) {
          results.push({ id: w.name, label: w.warehouse_name || w.name, type: "warehouse", route: `/warehouse/${w.name}` })
        }
      }
      if (suppliers.status === "fulfilled") {
        for (const s of suppliers.value) {
          results.push({ id: s.name, label: s.supplier_name || s.name, type: "supplier", route: `/suppliers/${s.name}` })
        }
      }
    } catch {
      // Silently fail — search is non-critical
    }

    return results
  },
}
