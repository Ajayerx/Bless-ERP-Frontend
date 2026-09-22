import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import PaymentReconciliation from "../PaymentReconciliation"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { server, resetFixtures, lastRequest, setReconJobRunning, type CapturedRequest } from "@/mocks/server"
import { resetDedupCache } from "@/services/frappe-client"
import { formatCurrency } from "@/lib/utils"

vi.mock("@/components/layout/Topbar", () => ({ default: () => null }))

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => {
  resetFixtures()
  resetDedupCache()
})
afterAll(() => server.close())
afterEach(() => {
  resetFixtures()
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

function getEntriesButton() {
  return screen.getByRole("button", { name: /Get Unreconciled Entries/i })
}

function allocateButton() {
  return screen.getByRole("button", { name: "Allocate" })
}

function reconcileButton() {
  return screen.getByRole("button", { name: "Reconcile" })
}

// Labels on required link fields carry a "*" appendix, so match non-exactly.
function byLabel(name: string) {
  return screen.getByLabelText(name, { exact: false })
}

// Party Type is a Link control on DocType (like the Desk form): focus opens the
// list, typing filters it, and the option is a button named after the doctype.
async function selectFieldBySearch(labelOrName: string, value: string, byPlaceholder = false) {
  const input = byPlaceholder ? screen.getByPlaceholderText(labelOrName) : byLabel(labelOrName)
  await user.click(input)
  await user.type(input, value)
  const option = await screen.findByRole("button", { name: new RegExp(value, "i") }, { timeout: 3000 })
  await user.click(option)
}

// Selecting the linked party: pick the party type first so the party field
// appears, then search the party doctype for the party.
async function selectParty(name: string, partyType = "Customer") {
  await selectFieldBySearch("Party Type", partyType)
  await waitFor(() => expect(screen.getByPlaceholderText("Select Party")).toBeInTheDocument())
  await selectFieldBySearch("Select Party", name, true)
}

function runDocMethod(method: string) {
  return lastRequest(
    (r) => r.path === "/api/method/run_doc_method" && String(r.body?.method ?? "") === method
  )
}

function waitForRequest(pred: (r: CapturedRequest) => boolean) {
  return expect.poll(() => lastRequest(pred) !== undefined, { timeout: 3000 }).toBe(true)
}

// Account fields in this form call search_link with reference_doctype
// "Payment Reconciliation"; the matcher can pin the exact search term.
function accountSearchPath(txt: string | undefined) {
  return (r: CapturedRequest) =>
    r.path === "/api/method/frappe.desk.search.search_link" &&
    String(r.query.doctype) === "Account" &&
    String(r.query.reference_doctype) === "Payment Reconciliation" &&
    (txt === undefined || String(r.query.txt ?? "") === txt)
}

function accountSearchFilters(txt: string): Record<string, unknown> | undefined {
  const req = lastRequest(accountSearchPath(txt))
  if (!req?.query.filters) return undefined
  return JSON.parse(req.query.filters) as Record<string, unknown>
}

describe("Payment Reconciliation workspace (ERPNext parity)", () => {
  it("clears the party filters on load and only shows Get once the party account is filled", async () => {
    renderPage()

    await waitFor(() => expect(byLabel("Company")).toHaveValue("Bless Erp"))
    // onload() clears party_type, party and receivable_payable_account.
    expect(byLabel("Party Type")).toHaveValue("")
    expect(screen.queryByPlaceholderText("Select Party")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Get Unreconciled Entries/i })).not.toBeInTheDocument()

    await selectParty("AlphaCorp")

    await waitFor(() => {
      expect(byLabel("Receivable / Payable Account")).toHaveValue("Debtors - BE")
    })
    // refresh() adds "Get Unreconciled Entries" once receivable_payable_account is set.
    expect(getEntriesButton()).toBeInTheDocument()
    expect(runDocMethod("get_unreconciled_entries")).toBeUndefined()
  })

  it("keeps the grid area hidden until Get returns rows (ERPNext section parity)", async () => {
    renderPage()
    await waitFor(() => expect(byLabel("Company")).toHaveValue("Bless Erp"))

    expect(screen.queryByRole("heading", { name: "Unreconciled Entries" })).not.toBeInTheDocument()
    expect(screen.queryByText("ACC-PAY-2026-00051")).not.toBeInTheDocument()

    await selectParty("AlphaCorp")
    await waitFor(() => expect(byLabel("Receivable / Payable Account")).toHaveValue("Debtors - BE"))
    await waitFor(() => expect(getEntriesButton()).toBeInTheDocument())

    expect(screen.queryByRole("heading", { name: "Unreconciled Entries" })).not.toBeInTheDocument()
    expect(screen.queryByText("ACC-PAY-2026-00051")).not.toBeInTheDocument()

    await user.click(getEntriesButton())

    expect(await screen.findByRole("heading", { name: "Unreconciled Entries" })).toBeInTheDocument()
    // ERPNext field_order puts the Invoices grid before Payments.
    const gridHeadings = screen.getAllByRole("heading", { name: /Invoices|Payments/ })
    expect(gridHeadings.map((h) => h.textContent)).toEqual(["Invoices", "Payments"])
    expect(screen.getByText("ACC-PAY-2026-00051")).toBeInTheDocument()
  })

  it("stacks Party Type directly under Company (ERPNext column_break_4 layout)", async () => {
    renderPage()
    await waitFor(() => expect(byLabel("Company")).toHaveValue("Bless Erp"))

    const column = (el: HTMLElement) => el.closest("[data-column]")?.getAttribute("data-column")

    // Company + Party Type share the left column; Party + accounts the right.
    expect(column(byLabel("Company"))).toBe("1")
    expect(column(byLabel("Party Type"))).toBe("1")

    await selectParty("AlphaCorp")
    await waitFor(() => expect(byLabel("Receivable / Payable Account")).toHaveValue("Debtors - BE"))
    expect(column(screen.getByPlaceholderText("Select Party"))).toBe("2")
    expect(column(byLabel("Receivable / Payable Account"))).toBe("2")
    expect(column(byLabel("Default Advance Account"))).toBe("2")
  })

  it("auto-fills Receivable + advance accounts from get_party_account when a party is picked", async () => {
    renderPage()
    await waitFor(() => expect(byLabel("Company")).toHaveValue("Bless Erp"))

    await selectParty("AlphaCorp")

    await waitFor(() => {
      expect(byLabel("Receivable / Payable Account")).toHaveValue("Debtors - BE")
    })
    expect(byLabel("Default Advance Account")).toHaveValue("Advances Received - BE")
    expect(lastRequest((r) => r.path.endsWith("erpnext.accounts.party.get_party_account"))).toBeTruthy()
  })

  it("fires the full Desk API sequence when a party is selected", async () => {
    renderPage()
    await selectParty("AlphaCorp")
    await waitFor(() => expect(byLabel("Receivable / Payable Account")).toHaveValue("Debtors - BE"))
    // 1. validate_link on the party + account (Link field parities)
    await waitForRequest((r) => r.path === "/api/method/frappe.client.validate_link")
    // 2. get_party_account
    await waitForRequest((r) => r.path.endsWith("erpnext.accounts.party.get_party_account"))
    // 3. is_auto_process_enabled (run_doc_method)
    await waitForRequest(
      (r) => r.path === "/api/method/run_doc_method" && String(r.body?.method ?? "") === "is_auto_process_enabled"
    )
    // 4. is_any_doc_running
    await waitForRequest((r) => r.path.endsWith("process_payment_reconciliation.is_any_doc_running"))
    // 5. get_queries_for_dimension_filters
    await waitForRequest((r) => r.path.endsWith("get_queries_for_dimension_filters"))
  })

  it("Get Unreconciled Entries pulls the party's payments and invoices into both grids", async () => {
    renderPage()
    await selectParty("AlphaCorp")
    await waitFor(() => expect(getEntriesButton()).toBeInTheDocument())

    await user.click(getEntriesButton())

    expect(await screen.findByText("ACC-PAY-2026-00051")).toBeInTheDocument()
    expect(screen.getByText("ACC-PAY-2026-00052")).toBeInTheDocument()
    expect(screen.getByText("ACC-SINV-2026-00031")).toBeInTheDocument()
    expect(screen.getByText("ACC-SINV-2026-00032")).toBeInTheDocument()
    expect(String(runDocMethod("get_unreconciled_entries")?.body?.method ?? "")).toBe(
      "get_unreconciled_entries"
    )
  })

  it("Allocate waterfall-fills invoices and carries the payment remainder as Difference", async () => {
    renderPage()
    await selectParty("BetaInc")
    await waitFor(() => expect(getEntriesButton()).toBeInTheDocument())
    await user.click(getEntriesButton())
    await screen.findByText("ACC-PAY-2026-00053")

    await user.click(allocateButton())

    // 1800 payment fills the 2000 invoice, the 412.50 journal leaves 212.50.
    await screen.findByText(formatCurrency(212.5, "CAD"))
    const allocated = screen.getAllByLabelText(
      "Allocated amount for ACC-SINV-2026-00033"
    ) as HTMLInputElement[]
    expect(allocated.map((i) => i.value)).toEqual(["1800", "200"])
    expect(runDocMethod("allocate_entries")).toBeTruthy()
  })

  it("routes rows with a Difference through the 'Reconcile Entries' dialog before posting", async () => {
    renderPage()
    await selectParty("BetaInc")
    await waitFor(() => expect(getEntriesButton()).toBeInTheDocument())
    await user.click(getEntriesButton())
    await screen.findByText("ACC-PAY-2026-00053")
    await user.click(allocateButton())
    await screen.findByText(formatCurrency(212.5, "CAD"))

    await user.click(reconcileButton())

    expect(
      await screen.findByText(
        "New Journal Entry will be posted for the difference amount to reconcile the entries."
      )
    ).toBeInTheDocument()
    // Without a difference account the mock reconcile raises (dialog gate).
    expect(runDocMethod("reconcile")).toBeUndefined()

    await user.type(
      screen.getByLabelText("Reconcile difference account for ACC-SINV-2026-00033"),
      "Exchange Gain Or Loss - BE"
    )
    await user.click(screen.getByRole("button", { name: "Reconcile Entries" }))

    expect(await screen.findByText("Successfully Reconciled")).toBeInTheDocument()
  })

  it("reconciles a zero-difference party directly and refreshes both grids", async () => {
    renderPage()
    await selectParty("AlphaCorp")
    await waitFor(() => expect(getEntriesButton()).toBeInTheDocument())
    await user.click(getEntriesButton())
    await screen.findByText("ACC-PAY-2026-00051")
    await user.click(allocateButton())
    await screen.findByRole("heading", { name: "Allocated Entries" })

    await user.click(reconcileButton())

    expect(screen.queryByText(/New Journal Entry will be posted/)).not.toBeInTheDocument()
    expect(await screen.findByText("Successfully Reconciled")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Unreconciled Entries" })).not.toBeInTheDocument()
    })
  })

  it("switches to the Payable side for suppliers (account + purchase invoices)", async () => {
    renderPage()
    await waitFor(() => expect(byLabel("Company")).toHaveValue("Bless Erp"))

    await selectParty("VendorOne", "Supplier")

    await waitFor(() => {
      expect(byLabel("Receivable / Payable Account")).toHaveValue("Creditors - BE")
    })
    expect(byLabel("Default Advance Account")).toHaveValue("Advances Paid - BE")

    await waitFor(() => expect(getEntriesButton()).toBeInTheDocument())
    await user.click(getEntriesButton())
    expect(await screen.findByText("ACC-PINV-2026-00021")).toBeInTheDocument()
    expect(screen.getByText("ACC-PAY-2026-00054")).toBeInTheDocument()
  })

  it("warns when a Process Payment Reconciliation job is already running for the party", async () => {
    setReconJobRunning("PREC-0001")
    renderPage()
    await selectParty("AlphaCorp")
    await waitFor(() => expect(getEntriesButton()).toBeInTheDocument())

    await user.click(getEntriesButton())

    expect(
      await screen.findByText(/Payment Reconciliation Job: PREC-0001 is running for this party/)
    ).toBeInTheDocument()
  })

  it("lines the Filters fields up in ERPNext's three-column order", async () => {
    renderPage()
    await waitFor(() => expect(byLabel("Company")).toHaveValue("Bless Erp"))
    await selectParty("AlphaCorp")
    await waitFor(() => expect(byLabel("Receivable / Payable Account")).toHaveValue("Debtors - BE"))

    const ids = [
      "recon-from-invoice-date",
      "recon-to-invoice-date",
      "recon-invoice-limit",
      "recon-from-posting-date",
      "recon-to-posting-date",
      "recon-payment-limit",
      "recon-min-invoice-amount",
      "recon-max-invoice-amount",
      "recon-bank-cash-account",
      "recon-min-payment-amount",
      "recon-max-payment-amount",
    ]
    const labelOf = (el: HTMLElement) =>
      el.id
        ? (document.querySelector(`label[for="${el.id}"]`)?.textContent ?? el.id).trim()
        : el.getAttribute("placeholder") ?? ""
    const inOrder = ids
      .map((id) => document.getElementById(id) as HTMLElement)
      .sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      )
      .map(labelOf)

    expect(inOrder).toEqual([
      "From Invoice Date",
      "To Invoice Date",
      "Invoice Limit",
      "From Payment Date",
      "To Payment Date",
      "Payment Limit",
      "Minimum Invoice Amount",
      "Maximum Invoice Amount",
      "Bank / Cash Account",
      "Minimum Payment Amount",
      "Maximum Payment Amount",
    ])
  })

  it("searches the Default Advance Account with the ERPNext v15 set_query filters (Customer)", async () => {
    renderPage()
    await selectParty("AlphaCorp")
    await waitFor(() => expect(byLabel("Default Advance Account")).toHaveValue("Advances Received - BE"))

    // Focusing a filled field opens the list (searches with txt "") using the
    // ERPNext set_query filters.
    await user.click(byLabel("Default Advance Account"))
    await waitForRequest(accountSearchPath(""))

    expect(accountSearchFilters("")).toEqual({
      company: "Bless Erp",
      is_group: 0,
      account_type: "Receivable",
      root_type: "Liability",
    })
    // Only the Receivable/Liability advance account is eligible.
    expect(await screen.findByRole("button", { name: /Advances Received - BE/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Debtors - BE/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Cash - BE/i })).not.toBeInTheDocument()
  })

  it("searches the Receivable / Payable Account with the ERPNext v15 set_query filters (Customer)", async () => {
    renderPage()
    await selectParty("AlphaCorp")
    await waitFor(() => expect(byLabel("Receivable / Payable Account")).toHaveValue("Debtors - BE"))

    await user.click(byLabel("Receivable / Payable Account"))
    await waitForRequest(accountSearchPath(""))

    expect(accountSearchFilters("")).toEqual({
      company: "Bless Erp",
      is_group: 0,
      account_type: "Receivable",
      root_type: "Asset",
    })
    expect(await screen.findByRole("button", { name: /Debtors - BE/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Advances Received - BE/i })).not.toBeInTheDocument()
  })

  it("searches the Default Advance Account with Payable/Asset filters for suppliers", async () => {
    renderPage()
    await selectParty("VendorOne", "Supplier")
    await waitFor(() => expect(byLabel("Default Advance Account")).toHaveValue("Advances Paid - BE"))

    await user.click(byLabel("Default Advance Account"))
    await waitForRequest(accountSearchPath(""))

    expect(accountSearchFilters("")).toEqual({
      company: "Bless Erp",
      is_group: 0,
      account_type: "Payable",
      root_type: "Asset",
    })
    expect(await screen.findByRole("button", { name: /Advances Paid - BE/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Creditors - BE/i })).not.toBeInTheDocument()
  })

  it("searches Bank / Cash Account with the in [Bank, Cash] account_type filter", async () => {
    renderPage()
    await selectParty("AlphaCorp")
    await waitFor(() => expect(byLabel("Receivable / Payable Account")).toHaveValue("Debtors - BE"))

    // An empty bank/cash field searches immediately on focus.
    await user.click(byLabel("Bank / Cash Account"))
    await waitForRequest(accountSearchPath(""))

    expect(accountSearchFilters("")).toEqual({
      company: "Bless Erp",
      is_group: 0,
      account_type: ["in", ["Bank", "Cash"]],
    })
    expect(await screen.findByRole("button", { name: /Cash - BE/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cheque - BE/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Wire Transfer - BE/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Debtors - BE/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Advances Received - BE/i })).not.toBeInTheDocument()
  })
})
