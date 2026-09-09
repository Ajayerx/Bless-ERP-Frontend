import { describe, it, expect, vi } from "vitest"
import { SALES_ORDER_EXPORT_FIELDS } from "../index"
import type { AppMessage } from "@/services/api-client"

/**
 * ERPNext Sales Order list parity — wire-format tests for the list mapper
 * (rawStatus/docstatus), bulk submit/cancel/delete, close_or_unclose,
 * export (data_import template) and multi-PDF print URL, mirroring the
 * payments list.service.test.ts harness.
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

function mockApiClient(overrides: {
  apiClient?: ReturnType<typeof vi.fn>
  apiClientWithBody?: ReturnType<typeof vi.fn>
  serverDownloadTemplate?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()
  const apiClient = overrides.apiClient ?? vi.fn(async () => [])
  const apiClientWithBody = overrides.apiClientWithBody ?? vi.fn(async () => ({}))
  const serverDownloadTemplate = overrides.serverDownloadTemplate ?? vi.fn(async () => new Blob(["a,b"], { type: "text/csv" }))
  vi.doMock("@/services/api-client", () => ({
    apiClient,
    apiClientWithBody,
    serverMessagesFromBody: mockServerMessages,
    failedNamesFromMessages: mockFailedNamesFromMessages,
    serverDownloadTemplate,
    ApiError: class extends Error {},
  }))
  return { apiClient, apiClientWithBody, serverDownloadTemplate }
}

describe("salesOrderService.list() mapDoc (rawStatus / docstatus parity)", () => {
  it("maps draft rows to rawStatus Draft, docstatus 0 and simplified status draft", async () => {
    const rows = [
      {
        name: "SAL-ORD-2026-0005",
        customer: "CUST-0009",
        customer_name: "Golden Harvest Organic",
        transaction_date: "2026-07-10",
        delivery_date: "2026-07-24",
        grand_total: 4300,
        status: "Draft",
        docstatus: 0,
        per_delivered: 0,
        per_billed: 0,
      },
    ]
    const apiClient = vi.fn(async (url: string) => {
      if (url.includes("limit_page_length=0")) return rows
      return rows
    })
    mockApiClient({ apiClient })
    const { salesOrderService } = await import("../index")

    const result = await salesOrderService.list({ page: 1, pageSize: 10 })

    expect(result.items).toHaveLength(1)
    const item = result.items[0]
    expect(item.name).toBe("SAL-ORD-2026-0005")
    expect(item.rawStatus).toBe("Draft")
    expect(item.docstatus).toBe(0)
    expect(item.status).toBe("draft")
    expect(item.fulfillmentStatus).toBe("pending")
    expect(item.total).toBe(4300)
  })

  it("maps submitted rows to the raw ERPNext status literal and docstatus 1", async () => {
    const rows = [
      {
        name: "SAL-ORD-2026-0001",
        customer: "CUST-0001",
        customer_name: "Maple Leaf Bakery",
        transaction_date: "2026-07-02",
        delivery_date: "2026-07-15",
        grand_total: 2450,
        status: "To Deliver and Bill",
        docstatus: 1,
        per_delivered: 50,
        per_billed: 10,
      },
    ]
    const apiClient = vi.fn(async () => rows)
    mockApiClient({ apiClient })
    const { salesOrderService } = await import("../index")

    const result = await salesOrderService.list({ page: 1, pageSize: 10 })

    expect(result.items[0].rawStatus).toBe("To Deliver and Bill")
    expect(result.items[0].docstatus).toBe(1)
    expect(result.items[0].status).toBe("confirmed")
    expect(result.items[0].fulfillmentStatus).toBe("partial")
  })

  it("maps cancelled rows to docstatus 2 and fulfillment cancelled", async () => {
    const rows = [
      {
        name: "SAL-ORD-2026-0006",
        customer: "CUST-0004",
        customer_name: "Great Lakes Trading",
        transaction_date: "2026-07-08",
        delivery_date: "2026-07-22",
        grand_total: 860,
        status: "Cancelled",
        docstatus: 2,
        per_delivered: 0,
        per_billed: 0,
      },
    ]
    const apiClient = vi.fn(async () => rows)
    mockApiClient({ apiClient })
    const { salesOrderService } = await import("../index")

    const result = await salesOrderService.list({ page: 1, pageSize: 10 })

    expect(result.items[0].rawStatus).toBe("Cancelled")
    expect(result.items[0].docstatus).toBe(2)
    expect(result.items[0].status).toBe("cancelled")
    expect(result.items[0].fulfillmentStatus).toBe("cancelled")
  })

  it("filters by status literal and wires the search as or_filters", async () => {
    const apiCalls: string[] = []
    const apiClient = vi.fn(async (url: string) => {
      apiCalls.push(url)
      return []
    })
    mockApiClient({ apiClient })
    const { salesOrderService } = await import("../index")

    await salesOrderService.list({ search: "maple", status: "Draft", page: 1, pageSize: 10 })

    const listUrl = apiCalls[0]
    const decoded = decodeURIComponent(listUrl)
    expect(decoded).toContain('filters=[["status","=","Draft"]]')
    expect(decoded).toContain(
      'or_filters=[["name","like","%maple%"],["customer_name","like","%maple%"],["customer","like","%maple%"]]'
    )
    expect(listUrl).toContain("limit_start=0")
    expect(listUrl).toContain("limit_page_length=10")
  })

  it("derives the load-more offset from page/pageSize", async () => {
    const apiCalls: string[] = []
    const apiClient = vi.fn(async (url: string) => {
      apiCalls.push(url)
      return []
    })
    mockApiClient({ apiClient })
    const { salesOrderService } = await import("../index")

    await salesOrderService.list({ page: 2, pageSize: 20 })

    expect(apiCalls[0]).toContain("limit_start=20")
    expect(apiCalls[0]).toContain("limit_page_length=20")
  })
})

describe("salesOrderService bulk toolbar wire format", () => {
  it("bulkSubmit posts doctype/action/docnames to bulk_update", async () => {
    const apiClientWithBody = vi.fn(async () => ({ message: null }))
    mockApiClient({ apiClientWithBody })
    const { salesOrderService } = await import("../index")

    const result = await salesOrderService.bulkSubmit(["SAL-ORD-2026-0005"])

    expect(result.enqueued).toBe(true)
    expect(result.failed).toEqual([])
    const url = apiClientWithBody.mock.calls[0][0] as string
    const body = new URLSearchParams((apiClientWithBody.mock.calls[0][1] as RequestInit).body as string)
    expect(url).toContain("/method/frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs")
    expect(body.get("doctype")).toBe("Sales Order")
    expect(body.get("action")).toBe("submit")
    expect(body.get("docnames")).toBe(JSON.stringify(["SAL-ORD-2026-0005"]))
  })

  it("bulkCancel reports the failed list from the server message", async () => {
    const apiClientWithBody = vi.fn(async () => ({ message: ["SAL-ORD-2026-0005"] }))
    mockApiClient({ apiClientWithBody })
    const { salesOrderService } = await import("../index")

    const result = await salesOrderService.bulkCancel(["SAL-ORD-2026-0005"])

    expect(result.enqueued).toBe(false)
    expect(result.failed).toEqual(["SAL-ORD-2026-0005"])
    const body = new URLSearchParams((apiClientWithBody.mock.calls[0][1] as RequestInit).body as string)
    expect(body.get("action")).toBe("cancel")
  })

  it("bulkDelete posts only deletable docs to reportview.delete_items", async () => {
    const apiClient = vi.fn(async (url: string) => {
      if (url.includes("%22amended_from%22%2C%22in%22")) return []
      return [
        { name: "SAL-ORD-2026-0005", docstatus: 0, amended_from: null },
        { name: "SAL-ORD-2026-0006", docstatus: 2, amended_from: null },
      ]
    })
    const apiClientWithBody = vi.fn(async () => ({ message: null }))
    mockApiClient({ apiClient, apiClientWithBody })
    const { salesOrderService } = await import("../index")

    const result = await salesOrderService.bulkDelete(["SAL-ORD-2026-0005", "SAL-ORD-2026-0006"])

    expect(result.failed).toEqual([])
    expect(result.deleted).toEqual(["SAL-ORD-2026-0005", "SAL-ORD-2026-0006"])
    const url = apiClientWithBody.mock.calls[0][0] as string
    const body = new URLSearchParams((apiClientWithBody.mock.calls[0][1] as RequestInit).body as string)
    expect(url).toContain("/method/frappe.desk.reportview.delete_items")
    expect(body.get("doctype")).toBe("Sales Order")
    expect(body.get("items")).toBe(JSON.stringify(["SAL-ORD-2026-0005", "SAL-ORD-2026-0006"]))
    expect(body.get("name")).toBeNull()
  })

  it("bulkDelete reports submitted and amendment-linked orders without deleting them", async () => {
    const apiClient = vi.fn(async (url: string) => {
      if (url.includes("%22amended_from%22%2C%22in%22")) {
        return [{ name: "SAL-ORD-2026-00002-1", amended_from: "SAL-ORD-2026-00002" }]
      }
      return [
        { name: "SAL-ORD-2026-00002", docstatus: 1, amended_from: null },
        { name: "SAL-ORD-2026-00022", docstatus: 1, amended_from: null },
        { name: "SAL-ORD-2026-00023", docstatus: 1, amended_from: null },
      ]
    })
    const apiClientWithBody = vi.fn()
    mockApiClient({ apiClient, apiClientWithBody })
    const { salesOrderService } = await import("../index")

    const result = await salesOrderService.bulkDelete([
      "SAL-ORD-2026-00002",
      "SAL-ORD-2026-00022",
      "SAL-ORD-2026-00023",
    ])

    expect(apiClientWithBody).not.toHaveBeenCalled()
    expect(result.deleted).toEqual([])
    expect(result.failed).toEqual(["SAL-ORD-2026-00002", "SAL-ORD-2026-00022", "SAL-ORD-2026-00023"])
    const lines = result.messages.map((m) => m.message).join("\n")
    expect(lines).toContain("SAL-ORD-2026-00002 is linked with Sales Order SAL-ORD-2026-00002-1")
    expect(lines).toContain("SAL-ORD-2026-00022 is already submitted")
    expect(lines).toContain("SAL-ORD-2026-00023 is already submitted")
  })

  it("closeOrUncloseSalesOrders posts the JSON name list and Closed status", async () => {
    const apiClient = vi.fn(async () => ({ message: "Closed" }))
    mockApiClient({ apiClient })
    const { salesOrderService } = await import("../index")

    await salesOrderService.closeOrUncloseSalesOrders(["SAL-ORD-2026-0001"], "Closed")

    const url = apiClient.mock.calls[0][0] as string
    const body = new URLSearchParams((apiClient.mock.calls[0][1] as RequestInit).body as string)
    expect(url).toContain("/method/erpnext.selling.doctype.sales_order.sales_order.close_or_unclose_sales_orders")
    expect(body.get("names")).toBe(JSON.stringify(["SAL-ORD-2026-0001"]))
    expect(body.get("status")).toBe("Closed")
  })
})

describe("salesOrderService export / print helpers", () => {
  it("exportRecords always sends export_fields with the default legend and doctype", async () => {
    const serverDownloadTemplate = vi.fn(async () => new Blob(["a,b"], { type: "text/csv" }))
    mockApiClient({ serverDownloadTemplate })
    const { salesOrderService } = await import("../index")

    const blob = await salesOrderService.exportRecords({ fileType: "CSV" })

    expect(blob.size).toBeGreaterThan(0)
    const options = serverDownloadTemplate.mock.calls[0][0]
    expect(options.doctype).toBe("Sales Order")
    expect(options.fileType).toBe("CSV")
    expect(options.recordMode).toBe("by_filter")
    expect(options.fields).toEqual(SALES_ORDER_EXPORT_FIELDS)
  })

  it("exportRecords forwards a selection filter when present", async () => {
    const serverDownloadTemplate = vi.fn(async () => new Blob(["a,b"], { type: "text/csv" }))
    mockApiClient({ serverDownloadTemplate })
    const { salesOrderService } = await import("../index")

    await salesOrderService.exportRecords({ filters: [["name", "in", ["SAL-ORD-2026-0001"]]] })

    const options = serverDownloadTemplate.mock.calls[0][0]
    expect(options.filters).toEqual([["name", "in", ["SAL-ORD-2026-0001"]]])
  })

  it("buildMultiPdfUrl serializes the ERPNext print params for Sales Order", async () => {
    mockApiClient()
    const { salesOrderService } = await import("../index")

    const url = salesOrderService.buildMultiPdfUrl(["SAL-ORD-2026-0001", "SAL-ORD-2026-0002"], {
      printFormat: "Standard",
      letterhead: "BlessERP",
      pageSize: "Legal",
    })

    expect(url.startsWith("/api/method/frappe.utils.print_format.download_multi_pdf?")).toBe(true)
    expect(url).toContain("doctype=Sales+Order")
    expect(url).toContain(`name=${encodeURIComponent(JSON.stringify(["SAL-ORD-2026-0001", "SAL-ORD-2026-0002"]))}`)
    expect(url).toContain("format=Standard")
    expect(url).toContain("no_letterhead=0")
    expect(url).toContain(`letterhead=${encodeURIComponent("BlessERP")}`)
    expect(url).toContain("options=" + encodeURIComponent(JSON.stringify({ "page-size": "Legal" })))
  })

  it("buildMultiPdfUrl omits the letterhead marker by default", async () => {
    mockApiClient()
    const { salesOrderService } = await import("../index")

    const url = salesOrderService.buildMultiPdfUrl(["SAL-ORD-2026-0001"])
    expect(url).toContain("no_letterhead=1")
    expect(url).toContain("format=Standard")
  })

  it("getPrintFormats queries the Print Format resource for Sales Order and falls back on error", async () => {
    const apiClient = vi.fn(async () => [{ name: "Standard" }, { name: "Sales Order Print" }])
    mockApiClient({ apiClient })
    const { salesOrderService } = await import("../index")

    const formats = await salesOrderService.getPrintFormats()

    const url = apiClient.mock.calls[0][0] as string
    expect(url).toContain("/resource/Print Format?")
    expect(decodeURIComponent(url)).toContain('[["doc_type","=","Sales Order"],["disabled","=",0]]')
    expect(formats).toEqual(["Standard", "Sales Order Print"])

    vi.resetModules()
    const failing = vi.fn(async () => { throw new Error("boom") })
    vi.doMock("@/services/api-client", () => ({
      apiClient: failing,
      apiClientWithBody: vi.fn(),
      serverMessagesFromBody: mockServerMessages,
      failedNamesFromMessages: mockFailedNamesFromMessages,
      serverDownloadTemplate: vi.fn(),
      ApiError: class extends Error {},
    }))
    const { salesOrderService: retried } = await import("../index")
    expect(await retried.getPrintFormats()).toEqual(["Standard"])
  })
})