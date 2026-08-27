import { describe, expect, it } from "vitest"
import {
  DEFAULT_FIELD_STATE,
  DEFAULT_RULES,
  isDocFieldEmpty,
  resolveDocstatusAware,
} from "../useVisibilityRules"

describe("isDocFieldEmpty (frappe is_value_internal parity)", () => {
  it.each([
    [null, true],
    [undefined, true],
    ["", true],
    [0, true],
    [false, true],
    [[], true],
    ["X", false],
    [1, false],
    [true, false],
    [["a"], false],
    [{ a: 1 }, false],
  ])("treats %s as empty=%s", (value: unknown, empty: boolean) => {
    expect(isDocFieldEmpty(value)).toBe(empty)
  })
})

describe("resolveDocstatusAware — ERPNext docstatus-driven rendering", () => {
  const editable = { ...DEFAULT_FIELD_STATE, allowOnSubmit: false }
  const onSubmit = { ...DEFAULT_FIELD_STATE, allowOnSubmit: true }
  const dependsOnReadOnly = { ...DEFAULT_FIELD_STATE, readOnly: true }

  it("draft (0): empty non-allow_on_submit field stays visible and editable", () => {
    const r = resolveDocstatusAware(editable, "", 0)
    expect(r.visible).toBe(true)
    expect(r.readOnly).toBe(false)
  })

  it("submitted (1): empty read-only field is hidden entirely", () => {
    const r = resolveDocstatusAware(editable, "", 1)
    expect(r.visible).toBe(false)
  })

  it("submitted (1): field with data stays visible but read-only", () => {
    const r = resolveDocstatusAware(editable, "Acme", 1)
    expect(r.visible).toBe(true)
    expect(r.readOnly).toBe(true)
  })

  it("submitted (1): allow_on_submit field stays visible + editable even when empty", () => {
    const r = resolveDocstatusAware(onSubmit, "", 1)
    expect(r.visible).toBe(true)
    expect(r.readOnly).toBe(false)
  })

  it("submitted (1): depends_on read-only field stays read-only with value", () => {
    const r = resolveDocstatusAware(dependsOnReadOnly, "x", 1)
    expect(r.readOnly).toBe(true)
    expect(r.visible).toBe(true)
  })

  it("cancelled (2): allow_on_submit field with value is shown but forced read-only", () => {
    const r = resolveDocstatusAware(onSubmit, "Letterhead", 2)
    expect(r.visible).toBe(true)
    expect(r.readOnly).toBe(true)
  })

  it("cancelled (2): allow_on_submit field is never editable", () => {
    const r = resolveDocstatusAware(onSubmit, "", 2)
    expect(r.readOnly).toBe(true)
  })

  it("submitted (1): exempt field (in_words) respects its own hiddenWhen, not emptiness", () => {
    // in_words is exempt — an empty value must not force-hide it.
    const r = resolveDocstatusAware(editable, "", 1, true)
    expect(r.visible).toBe(true)
  })

  it("submitted (1): empty table value hides (e.g. competitors never used here)", () => {
    const r = resolveDocstatusAware(editable, [], 1)
    expect(r.visible).toBe(false)
  })
})

describe("DEFAULT_RULES — customer_name no longer pinned hidden", () => {
  it("customer_name has no hiddenWhen rule (displays read-only per ERPNext)", () => {
    const rule = DEFAULT_RULES.find((r) => r.fieldname === "customer_name")
    expect(rule).toBeUndefined()
  })

  it("customer_group stays permanently hidden", () => {
    const rule = DEFAULT_RULES.find((r) => r.fieldname === "customer_group")
    expect(rule?.hiddenWhen).toBe("1=1")
  })

  it("party_name remains reqd", () => {
    const rule = DEFAULT_RULES.find((r) => r.fieldname === "party_name")
    expect(rule?.reqd).toBe(true)
  })

  it("allow_on_submit parity set unchanged (title, letter_head, group_same_items, select_print_heading, order_lost_reason, competitors)", () => {
    const allowOnSubmit = DEFAULT_RULES.filter((r) => r.allowOnSubmit).map((r) => r.fieldname)
    expect(allowOnSubmit.sort()).toEqual(
      ["title", "letter_head", "group_same_items", "select_print_heading", "order_lost_reason", "competitors"].sort(),
    )
  })
})