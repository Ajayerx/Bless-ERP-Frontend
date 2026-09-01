import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  __resetQuotationFreshness,
  enrichQuotationItem,
} from "../index"
import type { Quotation, QuotationItem } from "../../types"

let calls: Array<{ url: string; init: RequestInit }>

function benchDoc(overrides: Partial<Quotation> = {}): Partial<Quotation> {
  return {
    doctype: "Quotation",
    name: "SAL-QTN-00001",
    party_name: "CUST-0001",
    quotation_to: "Customer",
    transaction_date: "2026-08-21",
    currency: "CAD",
    conversion_rate: 1,
    selling_price_list: "Standard Selling",
    price_list_currency: "CAD",
    plc_conversion_rate: 1,
    company: "BlessERP Inc.",
    order_type: "Sales",
    ignore_pricing_rule: 0,
    items: [] as QuotationItem[],
    ...overrides,
  }
}

function item(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    name: "row1",
    item_code: "",
    item_name: "",
    qty: 2,
    uom: "",
    conversion_factor: 1,
    rate: 0,
    amount: 0,
    price_list_rate: 0,
    discount_percentage: 0,
    is_free_item: 0,
    is_alternative: 0,
    has_alternative_item: 0,
    ...overrides,
  }
}

function stubFetch(deskDetails: Record<string, unknown> | null) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init: init ?? {} })
    if (url.includes("get_item_details")) {
      return new Response(
        JSON.stringify({ message: deskDetails ?? null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }
    return new Response(JSON.stringify({ message: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  })
  vi.stubGlobal("fetch", fetchMock)
}

function methodNames(): string[] {
  return calls.map((c) => c.url.split("/method/")[1] ?? "")
}

beforeEach(() => {
  calls = []
  __resetQuotationFreshness()
})

describe("enrichQuotationItem (shared ERPNext item-select flow)", () => {
  it("validates the item link then fetches and merges desk item details", async () => {
    stubFetch({ item_code: "ITEM-A", item_name: "Item A", uom: "Nos", conversion_factor: 1, price_list_rate: 50, qty: 2 })

    const doc = benchDoc()
    const result = await enrichQuotationItem(doc, item(), "ITEM-A", {
      isNew: false,
      name: doc.name || "",
      company: doc.company,
    })

    const methods = methodNames()
    expect(methods).toContain("frappe.client.validate_link")

    const deskCall = calls.find((c) => c.url.includes("get_item_details"))
    expect(deskCall).toBeDefined()
    const params = new URLSearchParams(String(deskCall!.init!.body ?? ""))
    const docJson = JSON.parse(params.get("doc") ?? "{}")
    expect(docJson.doctype).toBe("Quotation")
    expect(docJson.party_name).toBe("CUST-0001")

    // price_list_rate 50, no margin/discount → rate 50, amount 50*qty(2)=100
    expect(result).not.toBeNull()
    expect(result!.item_code).toBe("ITEM-A")
    expect(result!.rate).toBe(50)
    expect(result!.amount).toBe(100)
    expect(result!.uom).toBe("Nos")
  })

  it("applies margin and discount to compute the net rate", async () => {
    stubFetch({
      item_code: "ITEM-B",
      item_name: "Item B",
      uom: "Nos",
      conversion_factor: 1,
      price_list_rate: 100,
      margin_type: "Percentage",
      margin_rate_or_amount: 10,
      discount_percentage: 10,
      qty: 1,
    })

    const doc = benchDoc()
    const result = await enrichQuotationItem(doc, item({ qty: 1 }), "ITEM-B", {
      isNew: false,
      name: doc.name || "",
      company: doc.company,
    })

    // rate_with_margin = 100 + 10% = 110; 10% discount → 99
    expect(result!.rate).toBe(99)
    expect(result!.amount).toBe(99)
  })

  it("returns null when the desk call yields no details", async () => {
    stubFetch(null)
    const doc = benchDoc()
    const result = await enrichQuotationItem(doc, item(), "MISSING", {
      isNew: false,
      name: doc.name || "",
      company: doc.company,
    })
    expect(result).toBeNull()
  })
})
