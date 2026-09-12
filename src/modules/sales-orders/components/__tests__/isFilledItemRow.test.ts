import { describe, it, expect } from "vitest"
import type { SalesOrderItemForm } from "../../types"
import { isFilledItemRow } from "../../utils/items"

function blankPlaceholder(): SalesOrderItemForm {
  return {
    name: "new-sales-order-item-abc",
    item_name: "",
    item_code: "",
    qty: 1,
    uom: "",
    conversion_factor: 1,
    price_list_rate: 0,
    rate: 0,
    amount: 0,
    discount_percentage: 0,
    reserve_stock: 1,
    delivered_by_supplier: 0,
    is_free_item: 0,
    grant_commission: 0,
  }
}

describe("isFilledItemRow", () => {
  it("treats the default blank placeholder row as empty", () => {
    expect(isFilledItemRow(blankPlaceholder())).toBe(false)
  })

  it("treats a row with an item code as filled", () => {
    const row = { ...blankPlaceholder(), item_code: "PRD-001" }
    expect(isFilledItemRow(row)).toBe(true)
  })

  it("treats a row with only an item name as filled", () => {
    const row = { ...blankPlaceholder(), item_name: "Bolts" }
    expect(isFilledItemRow(row)).toBe(true)
  })

  it("keeps description-only rows (quotation section rows) as filled", () => {
    const row = { ...blankPlaceholder(), description: "Section Heading" }
    expect(isFilledItemRow(row)).toBe(true)
  })
})