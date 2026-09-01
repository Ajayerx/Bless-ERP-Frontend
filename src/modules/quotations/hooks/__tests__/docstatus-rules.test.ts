import { describe, expect, it } from "vitest"
import {
  DEFAULT_FIELD_STATE,
  DEFAULT_RULES,
  isDocFieldEmpty,
  resolveDocstatusAware,
} from "../useVisibilityRules"

describe("isDocFieldEmpty (frappe is_null parity)", () => {
  it.each([
    [null, true],
    [undefined, true],
    ["", true],
    ["   ", true],
    ["X", false],
    [1, false],
    [true, false],
    [["a"], false],
    [{ a: 1 }, false],
  ])("treats %s as empty=%s", (value: unknown, empty: boolean) => {
    expect(isDocFieldEmpty(value)).toBe(empty)
  })

  it("does NOT treat 0 as empty (frappe is_null('0') is false)", () => {
    expect(isDocFieldEmpty(0)).toBe(false)
  })

  it("does NOT treat false as empty (frappe cstr(false) is 'false')", () => {
    expect(isDocFieldEmpty(false)).toBe(false)
  })

  it("treats empty array as empty (frappe cstr([]) is '')", () => {
    expect(isDocFieldEmpty([])).toBe(true)
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

  it("submitted (1): numeric 0 is NOT hidden (frappe is_null(0) is false)", () => {
    const r = resolveDocstatusAware(editable, 0, 1)
    expect(r.visible).toBe(true)
    expect(r.readOnly).toBe(true)
  })

  it("submitted (1): boolean false is NOT hidden (frappe cstr(false) is 'false')", () => {
    const r = resolveDocstatusAware(editable, false, 1)
    expect(r.visible).toBe(true)
    expect(r.readOnly).toBe(true)
  })

  it("cancelled (2): numeric 0 is shown but read-only", () => {
    const r = resolveDocstatusAware(editable, 0, 2)
    expect(r.visible).toBe(true)
    expect(r.readOnly).toBe(true)
  })
})

describe("DEFAULT_RULES — generated from FIELD_META (quotation.json)", () => {
  it("customer_name is read-only and permanently hidden (hidden:1 in quotation.json)", () => {
    const rule = DEFAULT_RULES.find((r) => r.fieldname === "customer_name")
    expect(rule).toBeDefined()
    expect(rule?.readOnly).toBe(true)
    expect(rule?.hiddenWhen).toBe("1=1")
  })

  it("customer_group stays permanently hidden (hidden:1 dominates)", () => {
    const rule = DEFAULT_RULES.find((r) => r.fieldname === "customer_group")
    expect(rule?.hiddenWhen).toBe("1=1")
  })

  it("title / customer_name / contact_email / enq_det / has_unit_price_items are permanently hidden", () => {
    for (const f of ["title", "customer_name", "contact_email", "enq_det", "has_unit_price_items"]) {
      const rule = DEFAULT_RULES.find((r) => r.fieldname === f)
      expect(rule?.hiddenWhen).toBe("1=1")
    }
  })

  it("party_name remains reqd", () => {
    const rule = DEFAULT_RULES.find((r) => r.fieldname === "party_name")
    expect(rule?.reqd).toBe(true)
  })

  it("naming_series is reqd and set_only_once", () => {
    const rule = DEFAULT_RULES.find((r) => r.fieldname === "naming_series")
    expect(rule?.reqd).toBe(true)
    expect(rule?.setOnlyOnce).toBe(true)
  })

  it("allow_on_submit parity matches ERPNext quotation.json set exactly", () => {
    const allowOnSubmit = DEFAULT_RULES.filter((r) => r.allowOnSubmit).map((r) => r.fieldname)
    expect(allowOnSubmit.sort()).toEqual(
      [
        "title",
        "letter_head",
        "group_same_items",
        "select_print_heading",
        "order_lost_reason",
        "lost_reasons",
        "competitors",
        "update_auto_repeat_reference",
      ].sort(),
    )
  })

  it("lost_reasons is read_only on every docstatus (read_only dominates allow_on_submit)", () => {
    const rule = DEFAULT_RULES.find((r) => r.fieldname === "lost_reasons")
    expect(rule?.readOnly).toBe(true)
    expect(rule?.allowOnSubmit).toBe(true)
  })

  it("ignore_pricing_rule is not statically read-only (permlevel-1 documented, role-gated)", () => {
    const rule = DEFAULT_RULES.find((r) => r.fieldname === "ignore_pricing_rule")
    expect(rule?.readOnly).toBeFalsy()
  })
})