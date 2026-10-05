import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import PaymentReconciliation from "../PaymentReconciliation"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { server, fixtures, resetFixtures, lastRequest, type CapturedRequest } from "@/mocks/server"
import { resetDedupCache } from "@/services/frappe-client"
import { resetCompanyDefaultsCache } from "@/services/company"

vi.mock("@/components/layout/Topbar", () => ({ default: () => null }))

// BUG-06: the Receivable / Payable Account picker filters Account search_link
// on `company: doc.company`, and doc.company used to be seeded with the
// fabricated literal "Bless Erp". Account is a child doctype of Company, so a
// company that does not match returns zero rows and the field says "No results
// found" with nothing to indicate why. The mock's Account options previously
// carried no `company` field, and matchesLinkFilter() treats absent fields as
// satisfied — so the filter was never exercised and the bug stayed hidden.
describe("Payment Reconciliation company scoping (BUG-06)", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
  beforeEach(() => {
    resetFixtures()
    resetDedupCache()
    resetCompanyDefaultsCache()
    localStorage.clear()
  })
  afterAll(() => server.close())
  afterEach(() => {
    resetFixtures()
    resetCompanyDefaultsCache()
    localStorage.clear()
    document.cookie = "user_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
    vi.restoreAllMocks()
  })

  const user = userEvent.setup()

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/payments/reconciliation"]}>
        <ToastProvider>
          <MessageDialogProvider>
            <PaymentReconciliation />
          </MessageDialogProvider>
        </ToastProvider>
      </MemoryRouter>
    )
  }

  function byLabel(name: string) {
    return screen.getByLabelText(name, { exact: false })
  }

  function accountSearch(txt?: string) {
    return lastRequest(
      (r: CapturedRequest) =>
        r.path === "/api/method/frappe.desk.search.search_link" &&
        String(r.query.doctype) === "Account" &&
        String(r.query.reference_doctype) === "Payment Reconciliation" &&
        (txt === undefined || String(r.query.txt ?? "") === txt)
    )
  }

  async function selectParty(name: string, partyType = "Customer") {
    const typeInput = byLabel("Party Type")
    await user.click(typeInput)
    await user.type(typeInput, partyType)
    await user.click(await screen.findByRole("button", { name: new RegExp(partyType, "i") }, { timeout: 3000 }))
    const partyInput = await screen.findByPlaceholderText("Select Party")
    await user.click(partyInput)
    await user.type(partyInput, name)
    await user.click(await screen.findByRole("button", { name: new RegExp(name, "i") }, { timeout: 3000 }))
  }

  it("sends the resolved company in the Account search filters", async () => {
    renderPage()
    await waitFor(() => expect(byLabel("Company")).toHaveValue(fixtures.company))
    await selectParty("AlphaCorp")

    await waitFor(() => expect(byLabel("Receivable / Payable Account")).toHaveValue("Debtors - BE"))

    // Focusing a filled Link field opens its list and emits search_link with the
    // field's set_query filters. That request is where the Company filter lives.
    await user.click(byLabel("Receivable / Payable Account"))
    await waitFor(() => expect(accountSearch()).toBeTruthy())
    const last = accountSearch()
    expect(last).toBeTruthy()
    const filters = JSON.parse(String(last?.query.filters)) as Record<string, unknown>
    expect(filters.company).toBe(fixtures.company)
  })

  it("honours the Company switcher selection over the site default", async () => {
    localStorage.setItem("blesserp_selected_company", "Some Other Co")
    renderPage()
    await waitFor(() => expect(byLabel("Company")).toHaveValue("Some Other Co"))
  })

  it("uses the User default when Global Defaults has none", async () => {
    // resolveCompany() reads the logged-in user's default_company, so the
    // session cookie must be present (server.ts get_logged_user reads it).
    document.cookie = "user_id=admin@blesserp.com; path=/"
    fixtures.companyGlobalDefault = ""
    fixtures.companyUserDefault = "BlessERP Inc."
    fixtures.companies = ["BlessERP Inc."]
    renderPage()
    await waitFor(() => expect(byLabel("Company")).toHaveValue("BlessERP Inc."))
  })

  it("shows an explicit banner instead of silently empty account dropdowns when no Company resolves", async () => {
    // Several companies, nothing configured as a default -> resolveCompany()
    // must return "" so the page can ask, never a fabricated name.
    fixtures.companyGlobalDefault = ""
    fixtures.companyUserDefault = ""
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      const json = (data: unknown) =>
        new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      if (url.includes("Global Defaults")) return json({ default_company: "" })
      if (url.includes("/resource/Company?fields")) return json([{ name: "Alpha" }, { name: "Beta" }])
      if (url.includes("/method/frappe.auth.get_logged_user")) return json("Guest")
      if (url.includes("/resource/Company/")) return json({ default_currency: "CAD" })
      return json({})
    })

    renderPage()

    await waitFor(() => expect(byLabel("Company")).toHaveValue(""))
    expect(await screen.findByText(/No Company selected/i)).toBeInTheDocument()
    expect(screen.getByText(/Accounts are per-company/i)).toBeInTheDocument()
    // The old fabricated literal must never reappear.
    expect(byLabel("Company")).not.toHaveValue("Bless Erp")
  })

  it("surfaces the company when the party has no account in it", async () => {
    renderPage()
    await waitFor(() => expect(byLabel("Company")).toHaveValue(fixtures.company))

    // GammaLtd is a real Customer in the mock but has no reconciliation
    // invoices/payments, so get_party_account returns [] for it.
    await selectParty("GammaLtd")

    const dialog = await screen.findByText(/No account found/i)
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`in company "${fixtures.company}"`, "i"))).toBeInTheDocument()
  })
})