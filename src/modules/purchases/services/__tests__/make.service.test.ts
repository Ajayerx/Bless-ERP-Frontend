import { describe, it, expect, vi } from "vitest"
import type { AppMessage } from "@/services/api-client"

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
  _names: string[],
  _messages: { message: string; indicator?: string }[],
): string[] => []

function mockClients(overrides: {
  apiClient?: ReturnType<typeof vi.fn>
  postMethodRaw?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()
  const apiClient = overrides.apiClient ?? vi.fn(async () => ({ doctype: "Purchase Invoice", name: "PUR-INV-0001" }))
  const postMethodRaw = overrides.postMethodRaw ?? vi.fn(async () => ({}))
  vi.doMock("@/services/api-client", () => ({
    apiClient,
    apiClientWithBody: vi.fn(async () => ({})),
    apiFormCall: vi.fn(async () => ({})),
    serverMessagesFromBody: mockServerMessages,
    failedNamesFromMessages: mockFailedNamesFromMessages,
    serverDownloadTemplate: vi.fn(async () => new Blob(["a,b"], { type: "text/csv" })),
    ApiError: class extends Error {},
  }))
  vi.doMock("@/services/frappe-client", () => ({
    postMethod: vi.fn(async () => ({})),
    postMethodRaw,
    getDocCount: vi.fn(async () => 0),
    validateLink: vi.fn(async () => true),
    getValue: vi.fn(async () => ({})),
  }))
  return { apiClient, postMethodRaw }
}

describe("purchaseOrderService amend (M3.2 ERPNext Amend parity)", () => {
  it("clones the submitted doc as a fresh draft with amended_from", async () => {
    const { postMethodRaw } = mockClients()
    postMethodRaw.mockResolvedValueOnce({
      docs: [{ name: "PUR-ORD-2026-0011", docstatus: 0, amended_from: "PUR-ORD-2026-0007" }],
    })
    const { purchaseOrderService } = await import("../index")

    const source = {
      doctype: "Purchase Order",
      name: "PUR-ORD-2026-0007",
      docstatus: 1,
      amended_from: null,
      supplier: "SUP-00003",
      supplier_name: "Pacific Coast Seafood",
      transaction_date: "2026-05-28",
      status: "Completed",
      advance_paid: 120.4,
      items: [
        { name: "row-1", parent: "PUR-ORD-2026-0007", parentfield: "items", parenttype: "Purchase Order", idx: 1, item_code: "PRD-004", qty: 5, rate: 10, amount: 50 },
      ],
    }

    const amended = await purchaseOrderService.amend(source as never)

    expect(amended.name).toBe("PUR-ORD-2026-0011")
    expect(postMethodRaw).toHaveBeenCalledTimes(1)
    const [endpoint, params] = postMethodRaw.mock.calls[0] as [string, { doc: string; action: string }]
    expect(endpoint).toBe("frappe.desk.form.save.savedocs")
    expect(params.action).toBe("Save")
    const doc = JSON.parse(params.doc) as Record<string, unknown>
    expect(doc.doctype).toBe("Purchase Order")
    expect(doc.amended_from).toBe("PUR-ORD-2026-0007")
    expect(doc.docstatus).toBe(0)
    expect(doc.advance_paid).toBe(0)
    expect(doc.supplier).toBe("SUP-00003")
    expect(doc.name).toBeUndefined()
    const item = (doc.items as Record<string, unknown>[])[0]
    expect(item.name).toBeUndefined()
    expect(item.parent).toBeUndefined()
    expect(item.item_code).toBe("PRD-004")
    expect(item.qty).toBe(5)
  })
})

describe("purchaseOrderService make-doc workflow (M3.2 Make Receipt / Make Invoice)", () => {
  it("makePurchaseReceipt calls make_mapped_doc with the PO receipt mapper", async () => {
    const { apiClient } = mockClients()
    apiClient.mockResolvedValueOnce({ doctype: "Purchase Receipt", name: "PUR-REC-0001" })
    const { purchaseOrderService } = await import("../index")

    const created = await purchaseOrderService.makePurchaseReceipt("PUR-ORD-2026-0006")

    expect(created).toEqual({ doctype: "Purchase Receipt", name: "PUR-REC-0001" })
    const [url, options] = apiClient.mock.calls[0] as [string, { method: string; body: string }]
    expect(url).toBe("/method/frappe.model.mapper.make_mapped_doc")
    expect(options.method).toBe("POST")
    const body = JSON.parse(options.body)
    expect(body.method).toBe("erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_receipt")
    expect(body.source_name).toBe("PUR-ORD-2026-0006")
  })

  it("makePurchaseInvoice calls make_mapped_doc with the PO invoice mapper", async () => {
    const { apiClient } = mockClients()
    apiClient.mockResolvedValueOnce({ doctype: "Purchase Invoice", name: "PUR-INV-0001" })
    const { purchaseOrderService } = await import("../index")

    const created = await purchaseOrderService.makePurchaseInvoice("PUR-ORD-2026-0005")

    expect(created).toEqual({ doctype: "Purchase Invoice", name: "PUR-INV-0001" })
    const [url, options] = apiClient.mock.calls[0] as [string, { method: string; body: string }]
    expect(url).toBe("/method/frappe.model.mapper.make_mapped_doc")
    const body = JSON.parse(options.body)
    expect(body.method).toBe("erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_invoice")
    expect(body.source_name).toBe("PUR-ORD-2026-0005")
  })
})