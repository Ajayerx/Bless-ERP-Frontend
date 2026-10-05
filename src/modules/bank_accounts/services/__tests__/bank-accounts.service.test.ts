import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest"

import { bankAccountService, type BankAccountFormData } from "@/services"
import { server, resetFixtures, lastRequest } from "@/mocks/server"

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => resetFixtures())
afterAll(() => server.close())
afterEach(() => resetFixtures())

const formData: BankAccountFormData = {
  account_name: "Operations Chequing",
  bank: "Royal Bank of Canada",
  is_company_account: true,
  company: "Bless Erp",
  account: "Cheque - BE",
  account_type: "Chequing",
  account_subtype: "Business",
  party_type: "",
  party: "",
  is_default: true,
  iban: "",
  bank_account_no: "R-5533-1200",
  branch_code: "00042",
  disabled: false,
  last_integration_date: "",
}

describe("bankAccountService (M3.5)", () => {
  it("lists bank accounts from the fixture set", async () => {
    const res = await bankAccountService.list()
    expect(res.total).toBeGreaterThanOrEqual(6)
    const names = res.items.map((b) => b.name)
    expect(names).toContain("Cheque - BE")
    expect(names).toContain("Northwind Foods - BMO")
    const companyAccount = res.items.find((b) => b.name === "Cheque - BE")
    expect(companyAccount?.is_company_account).toBe(1)
    expect(companyAccount?.is_default).toBe(1)
  })

  it("filters by search across account name", async () => {
    const res = await bankAccountService.list({ search: "wire fi" })
    expect(res.items.every((b) => b.account_name.toLowerCase().includes("wire fi"))).toBe(true)
  })

  it("applies status filter for disabled accounts", async () => {
    const res = await bankAccountService.list({ status: "disabled" })
    expect(res.total).toBeGreaterThanOrEqual(1)
    expect(res.items.every((b) => (b.disabled ?? 0) === 1)).toBe(true)
  })

  it("paginates with pageSize and reads count from get_count", async () => {
    const res = await bankAccountService.list({ pageSize: 3, page: 2 })
    expect(res.items.length).toBeLessThanOrEqual(3)
    expect(res.page).toBe(2)
    const countReq = lastRequest((r) => r.path === "/api/method/frappe.client.get_count")
    expect(countReq).toBeDefined()
  })

  it("fetches a single bank account by name", async () => {
    const doc = await bankAccountService.getById("Cheque - BE")
    expect(doc.account_name).toBe("Business Chequing")
    expect(doc.bank).toBe("Royal Bank of Canada")
    expect(doc.company).toBe("Bless Erp")
    expect(doc.account).toBe("Cheque - BE")
  })

  it("creates a company bank account (POST /resource/Bank Account)", async () => {
    const created = await bankAccountService.create(formData)
    expect(created.name).toBe("Operations Chequing - Royal Bank of Canada")
    expect(created.is_company_account).toBe(1)

    const req = lastRequest((r) => r.method === "POST" && r.path === "/api/resource/Bank Account")
    expect(req).toBeDefined()
    const body = req?.body as Record<string, unknown>
    expect(body.account_name).toBe("Operations Chequing")
    expect(body.account).toBe("Cheque - BE")
    expect(body.is_company_account).toBe(1)
  })

  it("updates a bank account (PUT)", async () => {
    const updated = await bankAccountService.update("Cheque - BE", { is_default: false, bank_account_no: "R-0000-0001" })
    expect(updated.is_default).toBe(0)
    expect(updated.name).toBe("Cheque - BE")
    const req = lastRequest((r) => r.method === "PUT" && r.path.includes("/api/resource/Bank Account/"))
    expect(req).toBeDefined()
  })

  it("deletes a bank account (DELETE)", async () => {
    await bankAccountService.delete("Savings - RBC")
    await expect(bankAccountService.getById("Savings - RBC")).rejects.toThrow()
  })

  it("searches banks via search_link", async () => {
    const items = await bankAccountService.searchLink("Bank", "royal")
    expect(items.some((i) => i.value === "Royal Bank of Canada")).toBe(true)
  })

  it("searches bank accounts via search_link honoring is_company_account filter", async () => {
    const items = await bankAccountService.searchLink("Bank Account", "", undefined, [
      ["is_company_account", "=", 1],
    ])
    expect(items.map((i) => i.value)).toContain("Cheque - BE")
  })

  it("validates links through frappe.client.validate_link", async () => {
    await expect(bankAccountService.validateLink("Bank", "Royal Bank of Canada")).resolves.toBeUndefined()
    const req = lastRequest((r) => r.path === "/api/method/frappe.client.validate_link")
    expect(req).toBeDefined()
  })

  it("fetches party types from the Party Type resource", async () => {
    const types = await bankAccountService.partyTypes()
    expect(types).toContain("Customer")
    expect(types).toContain("Supplier")
  })

  it("resolves bank account details via get_bank_account_details", async () => {
    const details = await bankAccountService.getBankAccountDetails("Cheque - BE")
    expect(details.account).toBe("Cheque - BE")
    expect(details.bank).toBe("Royal Bank of Canada")
    expect(details.bank_account_no).toBe("0048-4192-1133")
    const req = lastRequest((r) =>
      r.method === "POST" &&
      r.path.endsWith("bank_account.get_bank_account_details")
    )
    expect(req).toBeDefined()
  })

  it("creates a bank account via make_bank_account", async () => {
    const res = await bankAccountService.makeBankAccount("Customer", "AlphaCorp")
    expect(res.name).toBe("AlphaCorp Bank - Bank of Montreal")
    expect((res as { party?: string }).party).toBe("AlphaCorp")
    const req = lastRequest((r) =>
      r.method === "POST" &&
      r.path.endsWith("bank_account.make_bank_account")
    )
    expect(req).toBeDefined()
    const body = req?.body as { doctype?: string; docname?: string }
    expect(body.doctype).toBe("Customer")
    expect(body.docname).toBe("AlphaCorp")
  })

  it("exports records as a download blob", async () => {
    const blob = await bankAccountService.exportRecords({ fileType: "CSV", recordMode: "by_filter" })
    expect(blob).toBeInstanceOf(Blob)
  })
})