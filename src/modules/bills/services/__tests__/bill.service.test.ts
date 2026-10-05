import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest"

import { billService, type PurchaseInvoiceFormData } from "@/services"
import { server, resetFixtures, lastRequest } from "@/mocks/server"

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => resetFixtures())
afterAll(() => server.close())
afterEach(() => resetFixtures())

const baseForm = {
  supplier: "SUP-00001",
  supplier_name: "Northwind Foods",
  posting_date: "2026-09-01",
  due_date: "2026-09-15",
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
} as PurchaseInvoiceFormData

describe("billService parity (M3.3 ERPNext Purchase Invoice REST)", () => {
  it("lists through /api/resource/Purchase Invoice and maps indicator + statuses", async () => {
    const drafts = await billService.list({ status: "Draft" })

    const req = lastRequest((r) => r.method === "GET" && r.path === "/api/resource/Purchase Invoice")
    expect(req).toBeDefined()
    expect(String(req?.query?.fields ?? "")).toContain("supplier_name")
    expect(String(req?.query?.fields ?? "")).toContain("grand_total")
    expect(String(req?.query?.filters ?? "")).toContain('["Purchase Invoice","docstatus","=",0]')
    expect(drafts.total).toBe(3)
    expect(drafts.items.map((b) => b.name)).toEqual([
      "ACC-PINV-2026-0003",
      "ACC-PINV-2026-0002",
      "ACC-PINV-2026-0001",
    ])
    expect(drafts.items[0]).toMatchObject({
      name: "ACC-PINV-2026-0003",
      supplierId: "SUP-00003",
      supplierName: "Pacific Coast Seafood",
      docstatus: 0,
      indicator: "Draft",
    })
  })

  it("applies the default posting_date desc ordering and maps statuses", async () => {
    const all = await billService.list({})
    expect(all.total).toBe(9)
    expect(all.items).toHaveLength(9)
    expect(all.items[0].name).toBe("ACC-PINV-2026-0007")

    const cancelled = await billService.list({ status: "Cancelled" })
    expect(cancelled.total).toBe(1)
    expect(cancelled.items[0].name).toBe("ACC-PINV-2026-0008")
    expect(cancelled.items[0].indicator).toBe("Cancelled")
    expect(cancelled.items[0].status).toBe("cancelled")
  })

  it("Unpaid and Overdue status filters hit the server with the right tuples", async () => {
    const unpaid = await billService.list({ status: "Unpaid" })
    expect(unpaid.total).toBe(3)
    expect(unpaid.items.map((b) => b.name)).toEqual([
      "ACC-PINV-2026-0007",
      "ACC-PINV-2026-0004",
      "ACC-PINV-2026-0009",
    ])
    expect(unpaid.items[0].indicator).toBe("Overdue")

    const overdue = await billService.list({ status: "Overdue" })
    expect(overdue.total).toBe(4)
    expect(overdue.items[0].name).toBe("ACC-PINV-2026-0007")

    const req = lastRequest((r) => r.method === "GET" && r.path === "/api/resource/Purchase Invoice")
    expect(String(req?.query?.filters ?? "")).toContain('["Purchase Invoice","outstanding_amount",">",0]')
    expect(String(req?.query?.filters ?? "")).toContain('["Purchase Invoice","due_date","<"')
  })

  it("searches suppliers through the OR like-filter", async () => {
    const search = await billService.list({ search: "foods" })
    expect(search.total).toBe(3)
    expect(search.items.map((b) => b.name)).toEqual(
      expect.arrayContaining(["ACC-PINV-2026-0001", "ACC-PINV-2026-0005", "ACC-PINV-2026-0009"])
    )
    const req = lastRequest((r) => r.method === "GET" && r.path === "/api/resource/Purchase Invoice")
    expect(String(req?.query?.filters ?? "")).toContain(
      '["Purchase Invoice","supplier_name","like","%foods%"]'
    )
  })

  it("getById enriches the doc with items and derived balance fields", async () => {
    const detail = await billService.getById("ACC-PINV-2026-0001")

    expect(detail.name).toBe("ACC-PINV-2026-0001")
    expect(detail.supplierName).toBe("Northwind Foods")
    expect(detail.items.map((i) => i.itemCode)).toEqual(["PRD-001", "PRD-003"])
    expect(detail.grandTotal).toBe(601.16)
    expect(detail.docstatus).toBe(0)
    expect(detail.indicator).toBe("Draft")
  })

  it("getValue resolves the supplier display name through frappe.client.get_value", async () => {
    const res = await billService.getValue("Supplier", "supplier_name", { name: "SUP-00001" })

    const req = lastRequest((r) => r.method === "POST" && r.path.endsWith("frappe.client.get_value"))
    expect(req).toBeDefined()
    expect(res.supplier_name).toBe("Northwind Foods")
  })

  it("create saves through savedocs and returns a generated ACC-PINV series name", async () => {
    const created = await billService.create(baseForm)

    const req = lastRequest((r) => r.method === "POST" && r.path.endsWith("frappe.desk.form.save.savedocs"))
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.action).toBe("Save")
    const payload = JSON.parse(String(body.doc)) as Record<string, unknown>
    expect(payload.doctype).toBe("Purchase Invoice")
    expect(payload.supplier).toBe("SUP-00001")

    expect(created.name).toBe("ACC-PINV-2026-0010")
    expect(created.doctype).toBe("Purchase Invoice")
    expect(created.docstatus).toBe(0)
    expect(created.supplier).toBe("SUP-00001")
    expect(created.items).toHaveLength(1)
  })

  it("submitDoc submits a Draft through the resource PUT and flips to Unpaid", async () => {
    await billService.submitDoc("ACC-PINV-2026-0001")

    const req = lastRequest((r) => r.method === "PUT" && r.path === "/api/resource/Purchase Invoice/ACC-PINV-2026-0001")
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.docstatus).toBe(1)

    const detail = await billService.getById("ACC-PINV-2026-0001")
    expect(detail.docstatus).toBe(1)
    expect(detail.indicator).toBe("Overdue")
  })

  it("cancelDoc cancels a submitted bill but rejects on a draft", async () => {
    await billService.cancelDoc("ACC-PINV-2026-0004")

    const detail = await billService.getById("ACC-PINV-2026-0004")
    expect(detail.docstatus).toBe(2)
    expect(detail.indicator).toBe("Cancelled")

    await expect(billService.cancelDoc("ACC-PINV-2026-0001")).rejects.toThrow(
      "Purchase Invoice ACC-PINV-2026-0001 cannot be cancelled because it is not submitted",
    )
  })

  it("bulkSubmit submits the selected drafts through bulk_update and reports none failed", async () => {
    const result = await billService.bulkSubmit([
      "ACC-PINV-2026-0001",
      "ACC-PINV-2026-0002",
    ])

    const req = lastRequest(
      (r) => r.path.endsWith("bulk_update.submit_cancel_or_update_docs") && r.method === "POST"
    )
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.doctype).toBe("Purchase Invoice")
    expect(body.action).toBe("submit")

    expect(result.failed).toEqual([])
    const drafts = await billService.list({ status: "Draft" })
    expect(drafts.total).toBe(1)
    expect(drafts.items[0].name).toBe("ACC-PINV-2026-0003")
  })

  it("exportRecords posts a Purchase Invoice CSV template request", async () => {
    const blob = await billService.exportRecords({ fileType: "CSV", recordMode: "by_filter" })
    expect(blob).toBeInstanceOf(Blob)

    const req = lastRequest(
      (r) => r.path.endsWith("data_import.data_import.download_template") && r.method === "POST"
    )
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.doctype).toBe("Purchase Invoice")
    expect(body.file_type).toBe("CSV")
    expect(body.export_records).toBe("by_filter")
    expect(JSON.parse(String(body.export_fields))["Purchase Invoice"]).toContain("supplier")
  })
})