import { describe, it, expect } from "vitest"
import {
  getSalesOrderIndicator,
  INDICATOR_FILTER_TUPLES,
  SALES_ORDER_INDICATOR_LABELS,
  type SalesOrderIndicatorInput,
} from "../indicator"

function todayString(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${m}-${d}`
}

const base = (overrides: Partial<SalesOrderIndicatorInput> = {}): SalesOrderIndicatorInput => ({
  docstatus: 1,
  status: "To Deliver and Bill",
  skip_delivery_note: 0,
  per_delivered: 0,
  per_billed: 0,
  grand_total: 1000,
  delivery_date: todayString(),
  ...overrides,
})

/**
 * The indicator is a faithful port of frappe get_indicator (+ the Sales Order
 * doctype get_indicator in sales_order_list.js): docstatus short-circuits,
 * named statuses, then fulfillment/billing progress.
 */
describe("getSalesOrderIndicator", () => {
  it("short-circuits drafts and cancelled docs before the doctype indicator", () => {
    const draft = getSalesOrderIndicator(base({ docstatus: 0 }))
    expect(draft.label).toBe("Draft")
    expect(draft.variant).toBe("danger")
    expect(draft.filterArgs).toEqual([["docstatus", "=", 0]])

    const cancelled = getSalesOrderIndicator(base({ docstatus: 2 }))
    expect(cancelled.label).toBe("Cancelled")
    expect(cancelled.variant).toBe("danger")
    expect(cancelled.filterArgs).toEqual([["docstatus", "=", 2]])
  })

  it("marks past-due under-delivered submitted orders Overdue", () => {
    const indicator = getSalesOrderIndicator(base({ delivery_date: "2020-01-01" }))
    expect(indicator).toEqual({
      label: "Overdue",
      variant: "danger",
      filterArgs: INDICATOR_FILTER_TUPLES.Overdue,
    })
  })

  it("does not treat today's or future delivery dates as Overdue", () => {
    expect(getSalesOrderIndicator(base({ delivery_date: todayString() })).label).toBe("To Deliver and Bill")
    expect(getSalesOrderIndicator(base({ delivery_date: "2099-12-31" })).label).toBe("To Deliver and Bill")
  })

  it("uses the derived indicator, not the stored status, for overdue rows", () => {
    const indicator = getSalesOrderIndicator(
      base({ status: "To Deliver and Bill", delivery_date: "2020-01-01" }),
    )
    expect(indicator.label).toBe("Overdue")
  })

  it("returns To Deliver for a zero-grand_total not-yet-delivered order (future date)", () => {
    const indicator = getSalesOrderIndicator(base({ grand_total: 0 }))
    expect(indicator.label).toBe("To Deliver")
    expect(indicator.filterArgs).toEqual([
      ["per_delivered", "<", 100],
      ["grand_total", "=", 0],
      ["status", "!=", "Closed"],
      ["docstatus", "=", 1],
    ])
  })

  it("keeps Overdue ahead of the zero-grand_total branch (delivery past due)", () => {
    const indicator = getSalesOrderIndicator(base({ grand_total: 0, delivery_date: "2020-01-01" }))
    expect(indicator.label).toBe("Overdue")
  })

  it("returns To Deliver when delivered partially but fully billed", () => {
    const indicator = getSalesOrderIndicator(base({ per_billed: 100 }))
    expect(indicator.label).toBe("To Deliver")
    expect(indicator.filterArgs).toEqual(INDICATOR_FILTER_TUPLES["To Deliver"])
  })

  it("returns To Deliver and Bill when under-delivered and under-billed", () => {
    const indicator = getSalesOrderIndicator(base({}))
    expect(indicator.label).toBe("To Deliver and Bill")
    expect(indicator.filterArgs).toEqual(INDICATOR_FILTER_TUPLES["To Deliver and Bill"])
  })

  it("returns To Bill for fully delivered, partially billed orders", () => {
    const indicator = getSalesOrderIndicator(base({ per_delivered: 100, per_billed: 50 }))
    expect(indicator.label).toBe("To Bill")
    expect(indicator.filterArgs).toEqual(INDICATOR_FILTER_TUPLES["To Bill"])
  })

  it("uses the skip_delivery_note branch for un-billed orders", () => {
    const indicator = getSalesOrderIndicator(base({ skip_delivery_note: 1, per_delivered: 0 }))
    expect(indicator.label).toBe("To Bill")
    expect(indicator.filterArgs).toEqual([
      ["per_billed", "<", 100],
      ["status", "!=", "Closed"],
    ])
  })

  it.each([
    ["Closed", "success"],
    ["Completed", "success"],
    ["On Hold", "warning"],
  ] as const)("keeps the named %s status literal", (status, variant) => {
    const indicator = getSalesOrderIndicator(base({ status }))
    expect(indicator.label).toBe(status)
    expect(indicator.variant).toBe(variant)
    expect(indicator.filterArgs).toEqual(INDICATOR_FILTER_TUPLES[status])
  })

  it("falls back to Submitted (blue) for submitted docs nothing else matches", () => {
    const indicator = getSalesOrderIndicator(
      base({ status: "To Deliver and Bill", per_delivered: 100, per_billed: 100 }),
    )
    expect(indicator.label).toBe("Submitted")
    expect(indicator.variant).toBe("info")
    expect(indicator.filterArgs).toEqual([["docstatus", "=", 1]])
  })

  it("defines canonical filter tuples for every pill label", () => {
    expect(INDICATOR_FILTER_TUPLES.Overdue).toEqual([
      ["per_delivered", "<", 100],
      ["delivery_date", "<", "Today"],
      ["status", "!=", "Closed"],
      ["docstatus", "=", 1],
    ])
    for (const label of SALES_ORDER_INDICATOR_LABELS) {
      expect(INDICATOR_FILTER_TUPLES[label]).toBeDefined()
    }
  })
})