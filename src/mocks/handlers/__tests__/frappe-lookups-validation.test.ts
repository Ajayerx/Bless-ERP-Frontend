import { describe, it, expect } from "vitest"
import { validateSalesInvoice } from "../frappe-lookups"

const validItem = {
  item_code: "ITEM-0001",
  item_name: "Test Item",
  qty: 2,
  rate: 10,
  uom: "Nos",
}

const validBody = (): Record<string, unknown> => ({
  customer: "CUST-0001",
  company: "BlessERP Inc.",
  posting_date: "2026-09-01",
  currency: "CAD",
  conversion_rate: 1,
  selling_price_list: "Standard Selling",
  price_list_currency: "CAD",
  plc_conversion_rate: 1,
  items: [validItem],
})

describe("validateSalesInvoice (mock backend acknowledgment)", () => {
  it("accepts a valid payload", () => {
    expect(validateSalesInvoice(validBody())).toBe("")
  })

  it("rejects a missing customer", () => {
    expect(validateSalesInvoice({ ...validBody(), customer: "" })).toBe(
      "Customer is mandatory",
    )
  })

  it("rejects a missing company", () => {
    expect(validateSalesInvoice({ ...validBody(), company: undefined })).toBe(
      "Company is mandatory",
    )
  })

  it("rejects a missing posting date", () => {
    expect(validateSalesInvoice({ ...validBody(), posting_date: "" })).toBe(
      "Posting Date is mandatory",
    )
  })

  it("rejects a non-positive conversion_rate", () => {
    expect(validateSalesInvoice({ ...validBody(), conversion_rate: 0 })).toBe(
      "Exchange Rate must be greater than 0",
    )
  })

  it("rejects a non-positive plc_conversion_rate", () => {
    expect(validateSalesInvoice({ ...validBody(), plc_conversion_rate: -1 })).toBe(
      "Price List Exchange Rate must be greater than 0",
    )
  })

  it("accepts undefined conversion rates (defaults to 1)", () => {
    expect(
      validateSalesInvoice({
        ...validBody(),
        conversion_rate: undefined,
        plc_conversion_rate: undefined,
      }),
    ).toBe("")
  })

  it("rejects a payload with no items", () => {
    expect(validateSalesInvoice({ ...validBody(), items: [] })).toBe(
      "At least one item is required",
    )
  })

  it("rejects a row without an item", () => {
    expect(
      validateSalesInvoice({
        ...validBody(),
        items: [{ qty: 1, rate: 5, uom: "Nos" }],
      }),
    ).toBe("Row 1: Item is required")
  })

  it("rejects a row without a UOM", () => {
    expect(
      validateSalesInvoice({
        ...validBody(),
        items: [{ item_code: "ITEM-0002", qty: 1, rate: 5 }],
      }),
    ).toBe("Row 1: UOM is required")
  })

  it("rejects a negative qty", () => {
    expect(
      validateSalesInvoice({
        ...validBody(),
        items: [{ item_code: "ITEM-0002", qty: -1, rate: 5, uom: "Nos" }],
      }),
    ).toBe("Row 1: Qty cannot be negative")
  })

  it("rejects a negative rate", () => {
    expect(
      validateSalesInvoice({
        ...validBody(),
        items: [{ item_code: "ITEM-0002", qty: 1, rate: -2, uom: "Nos" }],
      }),
    ).toBe("Row 1: Rate cannot be negative")
  })

  it("accepts a zero-qty unit-price row (rate-adjustment)", () => {
    expect(
      validateSalesInvoice({
        ...validBody(),
        items: [{ item_code: "ITEM-0002", qty: 0, rate: 15, uom: "Nos" }],
      }),
    ).toBe("")
  })
})