import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest"

import { supplierService, type SupplierFormData } from "@/services"
import { server, resetFixtures, lastRequest } from "@/mocks/server"

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => resetFixtures())
afterAll(() => server.close())
afterEach(() => resetFixtures())

const baseForm: SupplierFormData = {
  supplier_name: "Bulk Foods Inc.",
  supplier_group: "Distributor",
  supplier_type: "Company",
  is_group: false,
  disabled: false,
  on_hold: false,
  default_payable_accounts: [],
}

describe("supplierService parity (M3.1 ERPNext Supplier REST)", () => {
  it("lists through the real /api/resource/Supplier path with ERPNext query params", async () => {
    const result = await supplierService.list({
      search: "Packaging",
      status: "on_hold",
      sortBy: "supplier_name",
      sortOrder: "asc",
    })

    const req = lastRequest((r) => r.method === "GET" && r.path === "/api/resource/Supplier")
    expect(req).toBeDefined()
    expect(String(req?.query?.fields ?? "")).toContain("supplier_name")
    expect(String(req?.query?.filters ?? "")).toContain(
      '["Supplier","supplier_name","like","%Packaging%"]'
    )
    expect(String(req?.query?.filters ?? "")).toContain('["Supplier","on_hold","=",1]')
    expect(req?.query?.limit_start).toBe("0")
    expect(req?.query?.limit_page_length).toBe("20")
    expect(String(req?.query?.order_by ?? "")).toContain("supplier_name ASC")

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      name: "SUP-00002",
      supplier_name: "Great Lakes Packaging",
      status: "on_hold",
      on_hold: 1,
      disabled: 0,
    })
    expect(result.total).toBe(1)
  })

  it("maps disabled + active statuses and applies the default name ordering", async () => {
    const disabled = await supplierService.list({ status: "disabled" })
    expect(disabled.items.map((s) => s.name).sort()).toEqual([
      "SUP-00003",
      "SUP-00007",
    ])
    expect(disabled.items.every((s) => s.status === "disabled")).toBe(true)

    const all = await supplierService.list({})
    expect(all.total).toBe(10)
    expect(all.items[0].supplier_name).toBe("Baker's Supply Depot")
    expect(all.items.map((s) => s.status)).toEqual(expect.arrayContaining(["active", "on_hold"]))
  })

  it("never hard-fails on the Purchase Invoice outstanding call (safe parallel fetch)", async () => {
    const result = await supplierService.list({})
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every((s) => typeof s.outstanding === "number")).toBe(true)
  })

  it("getById enriches the supplier doc with linked addresses and contacts", async () => {
    const detail = await supplierService.getById("SUP-00002")

    expect(detail.name).toBe("SUP-00002")
    expect(detail.supplier_group).toBe("Raw Material")
    expect(detail.status).toBe("on_hold")
    expect(detail.addresses).toHaveLength(1)
    expect(detail.addresses[0].name).toBe("SUP-ADDR-0002")
    expect(detail.contacts).toHaveLength(1)
    expect(detail.contacts[0].name).toBe("SUP-CON-0002")
  })

  it("create POSTs the flat ERPNext payload to /api/resource/Supplier", async () => {
    const created = await supplierService.create(baseForm)

    const req = lastRequest((r) => r.method === "POST" && r.path === "/api/resource/Supplier")
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.supplier_name).toBe("Bulk Foods Inc.")
    expect(body.supplier_group).toBe("Distributor")
    expect(body.supplier_type).toBe("Company")
    expect(body.is_group).toBe(0)
    expect(body.on_hold).toBe(0)
    expect(body.disabled).toBe(0)
    expect(body.default_payable_accounts).toEqual([])

    expect(created.name).toBe("SUP-00011")
    expect(created.status).toBe("active")
  })

  it("delete removes the supplier through reportview.delete_items", async () => {
    await supplierService.delete("SUP-00001")

    const req = lastRequest(
      (r) => r.path.endsWith("reportview.delete_items") && r.method === "POST"
    )
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.doctype).toBe("Supplier")
    expect(body.items).toBe(JSON.stringify(["SUP-00001"]))

    const remaining = await supplierService.list({})
    expect(remaining.items.find((s) => s.name === "SUP-00001")).toBeUndefined()
  })

  it("exportRecords posts a Supplier CSV template request", async () => {
    const blob = await supplierService.exportRecords({ fileType: "CSV", recordMode: "by_filter" })
    expect(blob).toBeInstanceOf(Blob)

    const req = lastRequest(
      (r) => r.path.endsWith("data_import.data_import.download_template") && r.method === "POST"
    )
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.doctype).toBe("Supplier")
    expect(body.file_type).toBe("CSV")
    expect(body.export_records).toBe("by_filter")
    expect(JSON.parse(String(body.export_fields))["Supplier"]).toContain("supplier_name")
  })
})