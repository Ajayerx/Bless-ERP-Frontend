import { apiClient } from "./api-client"

export interface SearchResult {
  id: string
  label: string
  description?: string
  type: "customer" | "product" | "invoice" | "payment" | "sales_order" | "warehouse"
  route: string
}

function buildListUrl(doctype: string, fields: string[], filters?: unknown[]): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(fields))
  if (filters) qp.set("filters", JSON.stringify(filters))
  qp.set("limit_page_length", "10")
  return `/resource/${encodeURIComponent(doctype)}?${qp.toString()}`
}

export const searchService = {
  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return []

    const trimmed = query.trim().toLowerCase()
    const results: SearchResult[] = []

    try {
      const [customers, products, invoices, payments, salesOrders] = await Promise.allSettled([
        apiClient<{ name: string; customer_name: string }[]>(
          buildListUrl("Customer", ["name", "customer_name"], [["customer_name", "like", `%${trimmed}%`]])
        ),
        apiClient<{ item_code: string; item_name: string }[]>(
          buildListUrl("Item", ["item_code", "item_name"], [["item_name", "like", `%${trimmed}%`]])
        ),
        apiClient<{ name: string; title: string }[]>(
          buildListUrl("Sales Invoice", ["name", "title"], [["title", "like", `%${trimmed}%`]])
        ),
        apiClient<{ name: string; party_name: string }[]>(
          buildListUrl("Payment Entry", ["name", "party_name"], [["party_name", "like", `%${trimmed}%`]])
        ),
        apiClient<{ name: string; title: string }[]>(
          buildListUrl("Sales Order", ["name", "title"], [["title", "like", `%${trimmed}%`]])
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
    } catch {
      // Silently fail — search is non-critical
    }

    return results
  },
}
