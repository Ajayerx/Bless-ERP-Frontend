import { beforeEach, describe, expect, it, vi } from "vitest"
import { quotationService } from "../index"

// BUG-02: erpnext.controllers.accounts_controller.get_taxes_and_charges
// (accounts_controller.py:3132-3150) returns the template's child rows as a
// bare Python list, or None when no master_name is given. It is *not* wrapped
// and carries no tax_category — that shape belongs to
// get_default_taxes_and_charges. The service used to type the response as
// `{ taxes }`, so `result.taxes` was always undefined and the Quotation tax
// rows never populated (a $200 quotation showed $0 tax instead of $29.95).
describe("quotationService.getTaxesAndCharges", () => {
  let nextResponse: unknown

  beforeEach(() => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ message: nextResponse }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
  })

  it("normalises the bare list ERPNext returns into { taxes }", async () => {
    nextResponse = [
      { charge_type: "On Net Total", account_head: "GST - BE", rate: 5 },
      { charge_type: "On Net Total", account_head: "QST - BE", rate: 9.975 },
    ]

    const result = await quotationService.getTaxesAndCharges("Canada GST/QST - BE")

    expect(result.taxes).toHaveLength(2)
    expect(result.taxes?.[0]).toMatchObject({ charge_type: "On Net Total", account_head: "GST - BE", rate: 5 })
    expect(result.taxes?.[1]).toMatchObject({ account_head: "QST - BE", rate: 9.975 })
    // get_taxes_and_charges never sets a tax_category.
    expect(result.tax_category).toBeUndefined()
  })

  it("returns { taxes: [] } for an unknown template", async () => {
    nextResponse = []
    await expect(quotationService.getTaxesAndCharges("No Such Template")).resolves.toEqual({ taxes: [] })
  })

  it("returns {} when the endpoint responds with null (no template name)", async () => {
    nextResponse = null
    await expect(quotationService.getTaxesAndCharges("")).resolves.toEqual({})
  })

  it("still accepts the wrapped { taxes } shape for forward compatibility", async () => {
    nextResponse = { tax_category: "Standard", taxes: [{ charge_type: "On Net Total", rate: 5 }] }
    const result = await quotationService.getTaxesAndCharges("Canada GST/QST - BE")
    expect(result.tax_category).toBe("Standard")
    expect(result.taxes).toHaveLength(1)
  })
})