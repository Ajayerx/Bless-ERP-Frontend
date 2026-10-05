import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest"

import { journalEntryService, type JournalEntryFormData } from "@/services"
import { server, resetFixtures, lastRequest } from "@/mocks/server"

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => resetFixtures())
afterAll(() => server.close())
afterEach(() => resetFixtures())

function balancedForm(overrides: Partial<JournalEntryFormData> = {}): JournalEntryFormData {
  return {
    doctype: "Journal Entry",
    name: undefined,
    naming_series: "ACC-JV-.YYYY.-",
    voucher_type: "Journal Entry",
    posting_date: "2026-09-20",
    company: "Bless Erp",
    finance_book: "",
    bill_no: "INV-9911",
    is_opening: 0,
    multi_currency: 0,
    remark: "Test reimbursement",
    user_remark: "Test reimbursement",
    title: "",
    accounts: [
      {
        key: "a1",
        account: "Travel - BE",
        party_type: "",
        party: "",
        account_currency: "CAD",
        exchange_rate: 1,
        debit: 120,
        credit: 0,
        cost_center: "Main - BE",
        project: "",
      },
      {
        key: "a2",
        account: "Cash - BE",
        party_type: "Supplier",
        party: "SUP-00001",
        account_currency: "CAD",
        exchange_rate: 1,
        debit: 0,
        credit: 120,
        cost_center: "Main - BE",
        project: "",
      },
    ],
    total_debit: 120,
    total_credit: 120,
    difference: 0,
    docstatus: 0,
    ...overrides,
  }
}

describe("journalEntryService (M3.6)", () => {
  it("lists journal entries with ERPNext columns", async () => {
    const res = await journalEntryService.list()
    expect(res.total).toBeGreaterThanOrEqual(5)
    const names = res.items.map((r) => r.number)
    expect(names).toContain("ACC-JV-2026-00001")
    const first = res.items.find((r) => r.number === "ACC-JV-2026-00001")
    expect(first?.status).toBe("submitted")
    expect(first?.total_debit).toBe(2500)
    expect(first?.total_credit).toBe(2500)
    expect(first?.voucher_type).toBe("Journal Entry")
    expect(first?.reference).toBe("")
    expect(first?.title).toBe("ACC-JV-2026-00001")
    expect(first?.posting_date).toBe("2026-09-10")
  })

  it("filters by submitted status (docstatus = 1)", async () => {
    const res = await journalEntryService.list({ status: "submitted" })
    expect(res.items.every((r) => r.status === "submitted")).toBe(true)
    expect(res.items.map((r) => r.number)).toContain("ACC-JV-2026-00001")
    const req = lastRequest((r) => r.path === "/api/resource/Journal Entry" && r.method === "GET")
    expect(String(req?.query?.filters ?? "")).toContain('["Journal Entry","docstatus","=",1]')
  })

  it("filters by voucher type", async () => {
    const res = await journalEntryService.list({
      filters: [["Journal Entry", "voucher_type", "=", "Bank Entry"]],
    })
    expect(res.items.map((r) => r.number)).toEqual(["ACC-JV-2026-00004"])
  })

  it("filters by an accounts child-table field (account)", async () => {
    const res = await journalEntryService.list({
      filters: [["accounts", "account", "=", "Rent - BE"]],
    })
    expect(res.items.map((r) => r.number)).toEqual(["ACC-JV-2026-00003"])
  })

  it("filters by a party child-table field", async () => {
    const res = await journalEntryService.list({
      filters: [["accounts", "party", "=", "SUP-00001"]],
    })
    expect(res.items.map((r) => r.number)).toEqual(["ACC-JV-2026-00002"])
  })

  it("searches across number/title/remark/bill_no", async () => {
    const res = await journalEntryService.list({ search: "Deloitte" })
    expect(res.items.map((r) => r.number)).toEqual(["ACC-JV-2026-00002"])
  })

  it("fetches a single doc with its accounts child table", async () => {
    const doc = await journalEntryService.getById("ACC-JV-2026-00003")
    expect(doc.name).toBe("ACC-JV-2026-00003")
    expect(doc.voucher_type).toBe("Journal Entry")
    expect(doc.docstatus).toBe(1)
    expect(doc.total_debit).toBe(5000)
    expect(doc.total_credit).toBe(5000)
    expect(doc.accounts?.length).toBe(2)
    expect(doc.accounts?.[0].account).toBe("Rent - BE")
    expect(doc.accounts?.[0].debit_in_account_currency).toBe(5000)
  })

  it("creates a balanced journal entry draft through savedocs", async () => {
    const created = await journalEntryService.create(balancedForm())
    expect(created.name).toMatch(/^ACC-JV-2026-\d{5}$/)
    expect(created.docstatus).toBe(0)
    expect(created.total_debit).toBe(120)
    expect(created.total_credit).toBe(120)
    expect(created.bill_no).toBe("INV-9911")
    expect(created.user_remark).toBe("Test reimbursement")
    expect(created.accounts?.length).toBe(2)

    const req = lastRequest((r) => r.method === "POST" && r.path.endsWith("frappe.desk.form.save.savedocs"))
    expect(req).toBeDefined()
    const docJson = (req?.body as Record<string, unknown> | undefined)?.doc
    const doc = JSON.parse(String(docJson))
    expect(doc.accounts.some((a: { account: string }) => a.account === "Travel - BE")).toBe(true)
    expect(doc.accounts[1].party).toBe("SUP-00001")
    expect(doc.exchange_rate ?? 0).toBe(0)
  })

  it("persists finance_book on create", async () => {
    const created = await journalEntryService.create(balancedForm({ finance_book: "Main - BE" }))
    expect(String((created as Record<string, unknown>).finance_book ?? "")).toBe("Main - BE")
  })

  it("updates a draft (remark / reference / accounts)", async () => {
    const updated = await journalEntryService.saveAs(
      {
        doctype: "Journal Entry",
        name: "ACC-JV-2026-00002",
        title: "Updated title",
        voucher_type: "Journal Entry",
        posting_date: "2026-09-12",
        company: "Bless Erp",
        bill_no: "REF-77",
        user_remark: "Accounting consultation revised",
        remark: "Accounting consultation revised",
        accounts: [
          {
            doctype: "Journal Entry Account",
            account: "Professional Services - BE",
            debit_in_account_currency: 1700,
            credit_in_account_currency: 0,
          },
          {
            doctype: "Journal Entry Account",
            account: "Cash - BE",
            debit_in_account_currency: 0,
            credit_in_account_currency: 1700,
          },
        ],
        total_debit: 1700,
        total_credit: 1700,
      },
      "Save",
    )
    expect(updated.name).toBe("ACC-JV-2026-00002")
    expect(updated.total_debit).toBe(1700)
    expect(updated.bill_no).toBe("REF-77")
    expect((updated as Record<string, unknown>).remark).toContain("revised")
  })

  it("submits a draft through the real docstatus flow", async () => {
    const doc = await journalEntryService.submitDoc("ACC-JV-2026-00004")
    expect(doc.docstatus).toBe(1)
    expect(doc.status).toBe("Submitted")
    const res = await journalEntryService.list({ status: "submitted" })
    expect(res.items.map((r) => r.number)).toContain("ACC-JV-2026-00004")
  })

  it("cancels a submitted doc to docstatus 2", async () => {
    await journalEntryService.cancelDoc("ACC-JV-2026-00001")
    const doc = await journalEntryService.getById("ACC-JV-2026-00001")
    expect(doc.docstatus).toBe(2)
    const req = lastRequest((r) => r.method === "POST" && r.path.endsWith("frappe.desk.form.save.cancel"))
    expect(req).toBeDefined()
  })

  it("rejects cancelling a draft", async () => {
    await expect(journalEntryService.cancelDoc("ACC-JV-2026-00002")).rejects.toThrow()
  })

  it("amends a submitted doc into a new draft copy", async () => {
    const source = await journalEntryService.getById("ACC-JV-2026-00001")
    const amended = await journalEntryService.amend(source)
    expect(amended.docstatus).toBe(0)
    expect(String((amended as Record<string, unknown>).amended_from ?? "")).toBe("ACC-JV-2026-00001")
    expect(amended.name).not.toBe("ACC-JV-2026-00001")
    expect(amended.accounts?.length).toBe(2)
  })

  it("exports records as a download blob", async () => {
    const blob = await journalEntryService.exportRecords({ fileType: "CSV" })
    expect(blob).toBeInstanceOf(Blob)
    const req = lastRequest((r) => r.method === "POST" && r.path.endsWith("data_import.download_template"))
    expect(req).toBeDefined()
  })

  it("searches accounts via search_link", async () => {
    const items = await journalEntryService.searchLink("Account", "cash")
    expect(items.some((i) => i.value.includes("Cash"))).toBe(true)
  })

  it("deletes a draft", async () => {
    await journalEntryService.delete("ACC-JV-2026-00002")
    const res = await journalEntryService.list()
    expect(res.items.some((r) => r.number === "ACC-JV-2026-00002")).toBe(false)
  })
})