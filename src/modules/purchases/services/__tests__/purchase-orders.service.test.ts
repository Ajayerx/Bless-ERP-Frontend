import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest"

import { purchaseOrderService, type PurchaseOrderFormData } from "@/services"
import { server, resetFixtures, lastRequest } from "@/mocks/server"

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => resetFixtures())
afterAll(() => server.close())
afterEach(() => resetFixtures())

const baseForm = {
  supplier: "SUP-00001",
  supplier_name: "Northwind Foods",
  transaction_date: "2026-09-01",
  schedule_date: "2026-09-15",
  company: "Bless Erp",
  currency: "CAD",
  conversion_rate: 1,
  buying_price_list: "Standard Buying",
  items: [
    {
      item_code: "PRD-001",
      item_name: "Organic All-Purpose Flour",
      qty: 10,
      rate: 18,
      amount: 180,
      uom: "Nos",
      conversion_factor: 1,
      price_list_rate: 18,
      discount_percentage: 0,
    },
  ],
  taxes: [],
  payment_schedule: [],
} as PurchaseOrderFormData

describe("purchaseOrderService parity (M3.2 ERPNext Purchase Order REST)", () => {
  it("lists through the real /api/resource/Purchase Order path with ERPNext query params", async () => {
    const result = await purchaseOrderService.list({ status: "Draft" })

    const req = lastRequest((r) => r.method === "GET" && r.path === "/api/resource/Purchase Order")
    expect(req).toBeDefined()
    expect(String(req?.query?.fields ?? "")).toContain("supplier_name")
    expect(String(req?.query?.fields ?? "")).toContain("grand_total")
    expect(String(req?.query?.filters ?? "")).toContain('["Purchase Order","docstatus","=",0]')
    expect(req?.query?.limit_start).toBe("0")
    expect(result.total).toBe(3)
    expect(result.items.map((po) => po.name)).toEqual([
      "PUR-ORD-2026-0003",
      "PUR-ORD-2026-0002",
      "PUR-ORD-2026-0001",
    ])
    expect(result.items[0]).toMatchObject({
      name: "PUR-ORD-2026-0003",
      supplierId: "SUP-00003",
      supplierName: "Pacific Coast Seafood",
      docstatus: 0,
      indicator: "Draft",
    })
  })

  it("applies the default transaction_date desc ordering and maps statuses", async () => {
    const all = await purchaseOrderService.list({})
    expect(all.total).toBe(9)
    expect(all.items).toHaveLength(9)
    expect(all.items[0].name).toBe("PUR-ORD-2026-0003")

    const cancelled = await purchaseOrderService.list({ status: "Cancelled" })
    expect(cancelled.total).toBe(1)
    expect(cancelled.items[0].name).toBe("PUR-ORD-2026-0009")
    expect(cancelled.items[0].indicator).toBe("Cancelled")
    expect(cancelled.items[0].status).toBe("cancelled")
  })

  it("honours pageLength and search through the like filter", async () => {
    const page = await purchaseOrderService.list({ pageLength: 5 })
    expect(page.items).toHaveLength(5)
    expect(page.pageSize).toBe(5)
    expect(page.totalPages).toBe(2)

    const search = await purchaseOrderService.list({ search: "seafood" })
    expect(search.total).toBe(2)
    expect(search.items.map((po) => po.name)).toEqual(
      expect.arrayContaining(["PUR-ORD-2026-0003", "PUR-ORD-2026-0007"])
    )
    const req = lastRequest((r) => r.method === "GET" && r.path === "/api/resource/Purchase Order")
    expect(String(req?.query?.filters ?? "")).toContain(
      '["Purchase Order","supplier_name","like","%seafood%"]'
    )
  })

  it("getById enriches the doc with items and derived fields", async () => {
    const detail = await purchaseOrderService.getById("PUR-ORD-2026-0001")

    expect(detail.name).toBe("PUR-ORD-2026-0001")
    expect(detail.supplierName).toBe("Northwind Foods")
    expect(detail.items.map((i) => i.productId)).toEqual(["PRD-001", "PRD-003", "PRD-008"])
    expect(detail.rawStatus).toBe("Draft")
    expect(detail.docstatus).toBe(0)
  })

  it("getValue resolves the supplier display name through frappe.client.get_value", async () => {
    const res = await purchaseOrderService.getValue("Supplier", "supplier_name", { name: "SUP-00001" })

    const req = lastRequest((r) => r.method === "POST" && r.path.endsWith("frappe.client.get_value"))
    expect(req).toBeDefined()
    expect(res.supplier_name).toBe("Northwind Foods")
  })

  it("create saves through savedocs and returns a generated 4-digit series name", async () => {
    const created = await purchaseOrderService.create(baseForm)

    const req = lastRequest((r) => r.method === "POST" && r.path.endsWith("frappe.desk.form.save.savedocs"))
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.action).toBe("Save")
    const payload = JSON.parse(String(body.doc)) as Record<string, unknown>
    expect(payload.doctype).toBe("Purchase Order")
    expect(payload.supplier).toBe("SUP-00001")

    expect(created.name).toBe("PUR-ORD-2026-0010")
    expect(created.doctype).toBe("Purchase Order")
    expect(created.docstatus).toBe(0)
    expect(created.supplier).toBe("SUP-00001")
    expect(created.items).toHaveLength(1)
  })

  it("submitDoc submits a Draft through the resource PUT", async () => {
    await purchaseOrderService.submitDoc("PUR-ORD-2026-0001")

    const req = lastRequest((r) => r.method === "PUT" && r.path === "/api/resource/Purchase Order/PUR-ORD-2026-0001")
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.docstatus).toBe(1)

    const detail = await purchaseOrderService.getById("PUR-ORD-2026-0001")
    expect(detail.docstatus).toBe(1)
    expect(detail.rawStatus).toBe("To Receive and Bill")
  })

  it("cancelDoc cancels a submitted doc but rejects on a Draft", async () => {
    await purchaseOrderService.cancelDoc("PUR-ORD-2026-0006")

    const detail = await purchaseOrderService.getById("PUR-ORD-2026-0006")
    expect(detail.docstatus).toBe(2)
    expect(detail.rawStatus).toBe("Cancelled")

    await expect(purchaseOrderService.cancelDoc("PUR-ORD-2026-0001")).rejects.toThrow(
      "cannot be cancelled because it is not submitted",
    )
  })

  it("bulkSubmit submits the selected drafts and reports none failed", async () => {
    const result = await purchaseOrderService.bulkSubmit([
      "PUR-ORD-2026-0001",
      "PUR-ORD-2026-0002",
    ])

    const req = lastRequest(
      (r) => r.path.endsWith("bulk_update.submit_cancel_or_update_docs") && r.method === "POST"
    )
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.doctype).toBe("Purchase Order")
    expect(body.action).toBe("submit")

    expect(result.failed).toEqual([])
    const drafts = await purchaseOrderService.list({ status: "Draft" })
    expect(drafts.total).toBe(1)
    expect(drafts.items[0].name).toBe("PUR-ORD-2026-0003")
  })

  it("exportRecords posts a Purchase Order CSV template request", async () => {
    const blob = await purchaseOrderService.exportRecords({ fileType: "CSV", recordMode: "by_filter" })
    expect(blob).toBeInstanceOf(Blob)

    const req = lastRequest(
      (r) => r.path.endsWith("data_import.data_import.download_template") && r.method === "POST"
    )
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.doctype).toBe("Purchase Order")
    expect(body.file_type).toBe("CSV")
    expect(body.export_records).toBe("by_filter")
    expect(JSON.parse(String(body.export_fields))["Purchase Order"]).toContain("supplier")
  })
})