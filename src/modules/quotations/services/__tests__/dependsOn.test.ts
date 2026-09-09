import { describe, expect, it } from "vitest"
import { evalDependsOn } from "../dependsOn"
import type { DependsOnContext } from "../dependsOn"

function ctx(values: Record<string, string | number | boolean | null | undefined | string[]>): DependsOnContext {
  return {
    getField: (fieldname) =>
      Object.prototype.hasOwnProperty.call(values, fieldname) ? values[fieldname] : undefined,
  }
}

// Regression guard for the tokenizer infinite loop: `!` is the negation alias,
// and `!name` must tokenize as a single ident (it used to leave the scanner
// pointer stationary, hanging the tab whenever a QuotationForm mounted).
describe("dependsOn tokenizer / evaluator", () => {
  it("terminates and negates !-prefixed fields (was an infinite loop)", () => {
    expect(evalDependsOn("!party_name", ctx({ party_name: "" }))).toBe(true)
    expect(evalDependsOn("!party_name", ctx({ party_name: "CUST-0001" }))).toBe(false)
  })

  it("evaluates mixed expressions containing ! and !=", () => {
    const c = ctx({
      quotation_to: "Customer",
      party_name: "",
      status: "Draft",
      incoterm: "",
      total_qty: 0,
    })
    expect(evalDependsOn("quotation_to!='Customer' or !party_name", c)).toBe(true)
    expect(evalDependsOn("!incoterm", c)).toBe(true)
    expect(evalDependsOn("!total_qty", c)).toBe(true)
    expect(evalDependsOn("status!='Lost'", c)).toBe(true)
  })

  it("handles dangling ! chars without hanging", () => {
    expect(() => evalDependsOn("a!", ctx({}))).not.toThrow()
    expect(() => evalDependsOn("!!!", ctx({}))).not.toThrow()
  })

  it("preserves basic comparisons and logical operators", () => {
    const c = ctx({ additional_discount_percentage: 5, disable_rounded_total: 1 })
    expect(evalDependsOn("additional_discount_percentage>0", c)).toBe(true)
    expect(evalDependsOn("disable_rounded_total", c)).toBe(true)
    expect(evalDependsOn("missing_field or true", c)).toBe(true)
    expect(evalDependsOn("", c)).toBe(true)
    expect(evalDependsOn("eval:true", c)).toBe(true)
  })

  it("supports && / || operators (were silently dropped)", () => {
    const c = { order_type: "Sales", skip_delivery_note: 1, docstatus: 0, reserve_stock: 0, a: 1, b: 0 }
    // && — second operand gates correctly (BUG: parseComparison used to eat
    // the && as a comparison op and return the left operand's truthiness)
    expect(evalDependsOn("order_type=='Sales' && !skip_delivery_note", ctx(c))).toBe(false)
    expect(evalDependsOn("order_type=='Maintenance' && !skip_delivery_note", ctx(c))).toBe(false)
    expect(evalDependsOn("order_type=='Sales' && !skip_delivery_note", ctx({ ...c, skip_delivery_note: 0 }))).toBe(true)
    expect(evalDependsOn("a == 1 && b == 2", ctx({ a: 1, b: 3 }))).toBe(false)
    expect(evalDependsOn("a == 1 && b == 2", ctx({ a: 1, b: 2 }))).toBe(true)
    // || — second operand is NOT dropped
    expect(evalDependsOn("docstatus == 0 || reserve_stock", ctx(c))).toBe(true)
    expect(evalDependsOn("docstatus == 1 || reserve_stock", ctx(c))).toBe(false)
    expect(evalDependsOn("docstatus == 1 || reserve_stock", ctx({ ...c, reserve_stock: 1 }))).toBe(true)
    expect(evalDependsOn("a == 1 || b == 2", ctx({ a: 0, b: 0 }))).toBe(false)
    // mixed && / || with parens
    expect(evalDependsOn("docstatus == 0 || (docstatus == 1 && reserve_stock)", ctx({ ...c, reserve_stock: 1 }))).toBe(true)
    expect(evalDependsOn("docstatus == 2 || (docstatus == 1 && reserve_stock)", ctx({ ...c, reserve_stock: 0 }))).toBe(false)
  })

  it("evaluates negated parenthesised && (per_picked-style rule)", () => {
    // !(!doc.__islocal && !doc.skip_delivery_note_creation); __islocal is
    // absent and skip_delivery_note_creation is 0 (falsy) → !(true) → false.
    const c = ctx({ skip_delivery_note_creation: 0 })
    expect(evalDependsOn("!(!doc.__islocal && !doc.skip_delivery_note_creation)", c)).toBe(false)
    expect(evalDependsOn("!(!doc.__islocal && !doc.skip_delivery_note_creation)", ctx({ skip_delivery_note_creation: 1 }))).toBe(true)
  })

  it("resolves truncated expressions to false (Frappe eval catch → field hidden)", () => {
    // Frappe's eval_depends_on returns false on a syntax error, hiding the
    // field. A dangling && now parses consistently instead of leaving tokens.
    expect(evalDependsOn("a &&", ctx({ a: 1 }))).toBe(false)
    expect(evalDependsOn("a &&", ctx({ a: 0 }))).toBe(false)
  })
})