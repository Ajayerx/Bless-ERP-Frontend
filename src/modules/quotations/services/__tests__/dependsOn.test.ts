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
})