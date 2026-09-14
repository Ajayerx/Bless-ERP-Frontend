import { describe, it, expect, vi } from "vitest"
import type { AppMessage } from "@/services/api-client"

/**
 * Wire-format tests for the Create menu service endpoints. Mirrors the
 * list.service.test.ts harness (mock @/services/api-client) and additionally
 * mocks @/services/frappe-client so postMethod endpoints / params can be
 * asserted. Covers make_work_orders, make_raw_material_request,
 * make_purchase_order and make_mapped_doc (delivery note) payload shapes that
 * started failing against the real bench (server-side endpoints return
 * unsaved docs / lists instead of mapped singles).
 */

const mockServerMessages = (body: unknown): AppMessage[] => {
  const raw = (body as Record<string, unknown>)?._server_messages
  if (typeof raw !== "string") return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const mockFailedNamesFromMessages = (
  names: string[],
  messages: { message: string; indicator?: string }[],
): string[] => {
  const errors = messages.filter((m) => (m.indicator ?? "").toLowerCase().includes("red"))
  if (errors.length === 0) return []
  const text = errors.map((m) => m.message.replace(/<[^>]*>/g, "")).join("\n")
  const matched = names.filter((name) =>
    new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(text)
  )
  return matched.length > 0 ? matched : names
}

function mockClients(overrides: {
  apiClient?: ReturnType<typeof vi.fn>
  apiClientWithBody?: ReturnType<typeof vi.fn>
  postMethod?: ReturnType<typeof vi.fn>
  postMethodRaw?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()
  const apiClient = overrides.apiClient ?? vi.fn(async () => ({ doctype: "Sales Invoice", name: "SI-0001" }))
  const apiClientWithBody = overrides.apiClientWithBody ?? vi.fn(async () => ({}))
  const serverDownloadTemplate = vi.fn(async () => new Blob(["a,b"], { type: "text/csv" }))
  const postMethod = overrides.postMethod ?? vi.fn(async () => ({}))
  const postMethodRaw = overrides.postMethodRaw ?? vi.fn(async () => ({}))
  vi.doMock("@/services/api-client", () => ({
    apiClient,
    apiClientWithBody,
    apiFormCall: vi.fn(async () => ({})),
    serverMessagesFromBody: mockServerMessages,
    failedNamesFromMessages: mockFailedNamesFromMessages,
    serverDownloadTemplate,
    ApiError: class extends Error {},
  }))
  vi.doMock("@/services/frappe-client", () => ({
    postMethod,
    postMethodRaw,
    withDedup: (key: string, _ttlMs: number, fn: () => Promise<unknown>) => fn(),
    resetDedupCache: () => {},
  }))
  return { apiClient, apiClientWithBody, postMethod, postMethodRaw }
}

describe("salesOrderService makeWorkOrders", () => {
  it("posts the ERPNext action with a JSON items envelope", async () => {
    const { postMethod } = mockClients()
    const { salesOrderService } = await import("../index")

    const items = [
      {
        bom: "BOM-PRD-001",
        item_code: "PRD-001",
        pending_qty: 10,
        sales_order_item: "item-row-1",
        warehouse: "Stores",
        description: "Wild Blueberry Jam",
      },
    ]
    await salesOrderService.makeWorkOrders(items, "SAL-ORD-2026-0001", "Bless & Co.")

    expect(postMethod).toHaveBeenCalledTimes(1)
    const [endpoint, params] = postMethod.mock.calls[0] as [string, Record<string, unknown>]
    expect(endpoint).toBe("erpnext.selling.doctype.sales_order.sales_order.make_work_orders")
    expect(JSON.parse(params.items as string)).toEqual({ items })
    expect(params.sales_order).toBe("SAL-ORD-2026-0001")
    expect(params.company).toBe("Bless & Co.")
    expect(params.project).toBe("")
  })

  it("forwards the project slot when provided", async () => {
    const { postMethod } = mockClients()
    const { salesOrderService } = await import("../index")

    await salesOrderService.makeWorkOrders([], "SAL-ORD-2026-0001", "Bless & Co.", "PRJ-0001")

    const [, params] = postMethod.mock.calls[0] as [string, Record<string, unknown>]
    expect(params.project).toBe("PRJ-0001")
  })
})

describe("salesOrderService makeRawMaterialRequest", () => {
  it("posts exploded/ignore flags plus the items array", async () => {
    const { postMethod } = mockClients()
    const { salesOrderService } = await import("../index")

    await salesOrderService.makeRawMaterialRequest(
      [{ item_code: "RM-001", warehouse: "Stores", bom: "BOM-PRD-001", required_qty: 2 }],
      "Bless & Co.",
      "SAL-ORD-2026-0001",
      undefined,
      { includeExplodedItems: true, ignoreExistingOrderedQty: true },
    )

    expect(postMethod).toHaveBeenCalledTimes(1)
    const [endpoint, params] = postMethod.mock.calls[0] as [string, Record<string, unknown>]
    expect(endpoint).toBe("erpnext.selling.doctype.sales_order.sales_order.make_raw_material_request")
    const body = JSON.parse(params.items as string)
    expect(body).toEqual({
      include_exploded_items: 1,
      ignore_existing_ordered_qty: 1,
      items: [{ item_code: "RM-001", warehouse: "Stores", bom: "BOM-PRD-001", required_qty: 2 }],
    })
    expect(params.company).toBe("Bless & Co.")
    expect(params.sales_order).toBe("SAL-ORD-2026-0001")
    expect(params.project).toBe("")
  })

  it("defaults both flags to 0 when opts are omitted", async () => {
    const { postMethod } = mockClients()
    const { salesOrderService } = await import("../index")

    await salesOrderService.makeRawMaterialRequest([], "Bless & Co.", "SAL-ORD-2026-0001")

    const [, params] = postMethod.mock.calls[0] as [string, Record<string, unknown>]
    expect(JSON.parse(params.items as string)).toEqual({
      include_exploded_items: 0,
      ignore_existing_ordered_qty: 0,
      items: [],
    })
  })
})

describe("salesOrderService makePurchaseOrder", () => {
  it("posts the direct endpoint with source_name and JSON-selected items", async () => {
    const { apiClient } = mockClients()
    const { salesOrderService } = await import("../index")

    const selected = [
      { name: "row-1", item_code: "PRD-001", pending_qty: 8, supplier: "SUP-0001" },
    ]
    await salesOrderService.makePurchaseOrder("SAL-ORD-2026-0001", selected)

    expect(apiClient).toHaveBeenCalledTimes(1)
    const [url, options] = apiClient.mock.calls[0] as [string, { method: string; body: string }]
    expect(url).toBe("/method/erpnext.selling.doctype.sales_order.sales_order.make_purchase_order")
    expect(options.method).toBe("POST")
    const body = JSON.parse(options.body)
    expect(body.source_name).toBe("SAL-ORD-2026-0001")
    expect(JSON.parse(body.selected_items)).toEqual(selected)
  })
})

describe("salesOrderService makeDeliveryNote", () => {
  it("calls make_mapped_doc without an args key when no dates are passed", async () => {
    const { apiClient } = mockClients()
    const { salesOrderService } = await import("../index")

    await salesOrderService.makeDeliveryNote("SAL-ORD-2026-0001")

    const [url, options] = apiClient.mock.calls[0] as [string, { body: string }]
    expect(url).toBe("/method/frappe.model.mapper.make_mapped_doc")
    const body = JSON.parse(options.body)
    expect(body.method).toBe("erpnext.selling.doctype.sales_order.sales_order.make_delivery_note")
    expect(body.source_name).toBe("SAL-ORD-2026-0001")
    expect("args" in body).toBe(false)
  })

  it("passes delivery_dates / for_reserved_stock as a JSON args envelope", async () => {
    const { apiClient } = mockClients()
    const { salesOrderService } = await import("../index")

    await salesOrderService.makeDeliveryNote("SAL-ORD-2026-0001", {
      delivery_dates: ["2026-07-20", "2026-07-25"],
      for_reserved_stock: true,
    })

    const [, options] = apiClient.mock.calls[0] as [string, { body: string }]
    const body = JSON.parse(options.body)
    expect(JSON.parse(body.args)).toEqual({
      delivery_dates: ["2026-07-20", "2026-07-25"],
      for_reserved_stock: true,
    })
  })
})

