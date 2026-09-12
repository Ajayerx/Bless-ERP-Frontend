import { describe, it, expect } from "vitest"
import { moneyInWords } from "../moneyInWords"

describe("moneyInWords", () => {
  it("renders the currency name, not the ISO code", () => {
    expect(moneyInWords(2021250, "CAD")).toBe(
      "Canadian Dollar Two Million, Twenty One Thousand, Two Hundred And Fifty only.",
    )
  })

  it("renders zero with the currency name", () => {
    expect(moneyInWords(0, "CAD")).toBe("Canadian Dollar Zero only.")
  })

  it("falls back to the code for unknown currencies", () => {
    expect(moneyInWords(100, "XYZ")).toBe("XYZ One Hundred only.")
  })

  it("defaults to CAD when no currency is given", () => {
    expect(moneyInWords(5)).toBe("Canadian Dollar Five only.")
  })

  it("renders fraction-only amounts without the main currency", () => {
    expect(moneyInWords(0.5, "CAD")).toBe("Fifty Cent only.")
  })

  it("appends the fraction currency after the words", () => {
    expect(moneyInWords(21250.5, "CAD")).toBe(
      "Canadian Dollar Twenty One Thousand, Two Hundred And Fifty and Fifty Cent only.",
    )
  })
})