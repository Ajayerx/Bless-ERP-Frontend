import { render, screen, waitFor, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import BankReconciliationTool from "../BankReconciliationTool"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { server, resetFixtures } from "@/mocks/server"
import { formatCurrency } from "@/lib/utils"

vi.mock("@/components/layout/Topbar", () => ({ default: () => null }))

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => resetFixtures())
afterAll(() => server.close())
afterEach(() => {
  resetFixtures()
  vi.restoreAllMocks()
})

const user = userEvent.setup()

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/bank-reconciliation"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <BankReconciliationTool />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

async function selectBankAccount(name = "Cheque - BE") {
  const input = screen.getByPlaceholderText("Select Bank Account")
  await user.click(input)
  await user.type(input, name)
  const option = await screen.findByRole("button", { name: new RegExp(name, "i") })
  await user.click(option)
}

async function loadTransactions() {
  await selectBankAccount()
  fireEvent.change(screen.getByLabelText("From Date"), { target: { value: "2026-08-01" } })
  fireEvent.change(screen.getByLabelText("To Date"), { target: { value: "2026-12-31" } })
  await user.click(screen.getByRole("button", { name: /Get Unreconciled Entries/i }))
  await screen.findByText("AlphaCorp wire transfer")
}

function rowFor(description: string) {
  return screen.getByText(description).closest("tr") as HTMLTableRowElement
}

describe("Bank Reconciliation Tool (ERPNext parity)", () => {
  it("hides the statement dates until a Bank Account is picked, then requires one before fetching", async () => {
    renderPage()

    await waitFor(() => expect(screen.getByLabelText("Company")).toHaveValue("Bless Erp"))

    // bank_statement_from_date / to_date: depends_on doc.bank_account
    expect(screen.queryByLabelText("From Date")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("To Date")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Get Unreconciled Entries/i }))
    expect(await screen.findByText("Bank Account is required")).toBeInTheDocument()

    await selectBankAccount()

    // onload() prefills the default range (last month → today).
    expect((screen.getByLabelText("From Date") as HTMLInputElement).value).not.toBe("")
  })

  it("lists bank transactions and shows the ERP closing balance number card", async () => {
    renderPage()
    await loadTransactions()

    expect(screen.getByText("AlphaCorp wire transfer 2")).toBeInTheDocument()
    expect(screen.getByText("VendorOne")).toBeInTheDocument()
    expect(screen.getAllByText(formatCurrency(1500, "CAD")).length).toBeGreaterThan(0)
    expect(screen.getByText("Closing Balance as per ERP")).toBeInTheDocument()
    expect(screen.getAllByText(formatCurrency(245000.5, "CAD")).length).toBeGreaterThan(0)
  })

  it("computes the Difference card (statement − ERP)", async () => {
    renderPage()
    await loadTransactions()

    fireEvent.change(screen.getByLabelText("Closing Balance"), {
      target: { value: "245100.5" },
    })

    expect(await screen.findByText(formatCurrency(100, "CAD"))).toBeInTheDocument()
  })

  it("runs Auto Reconcile for exact-amount matches", async () => {
    renderPage()
    await loadTransactions()

    await user.click(screen.getByRole("button", { name: "Auto Reconcile" }))

    expect(await screen.findByText(/Auto Reconciliation completed/)).toBeInTheDocument()
  })

  it("matches a voucher against a bank transaction from the Actions dialog", async () => {
    renderPage()
    await loadTransactions()

    await user.click(within(rowFor("AlphaCorp wire transfer")).getByRole("button", { name: "Actions" }))
    await screen.findByText("Match Against Voucher")

    // Exact candidate for the 1500 deposit.
    await screen.findByText("ACC-PAY-2026-00051")
    await user.click(screen.getByLabelText("Select ACC-PAY-2026-00051"))
    await user.click(screen.getByRole("button", { name: "Reconcile" }))

    expect(await screen.findByText("Bank Transaction BT-2026-0001 Matched")).toBeInTheDocument()
  })

  it("updates a bank transaction's reference/party from the dialog", async () => {
    renderPage()
    await loadTransactions()

    await user.click(within(rowFor("Bank service charges")).getByRole("button", { name: "Actions" }))
    await screen.findByText("Update Bank Transaction")

    await user.selectOptions(screen.getByLabelText("Action"), "update")
    const refInput = screen.getByLabelText("Reference Number")
    await user.clear(refInput)
    await user.type(refInput, "FEE-2026")
    await user.click(screen.getByRole("button", { name: "Update" }))

    expect(await screen.findByText("Bank Transaction BT-2026-0003 updated")).toBeInTheDocument()
  })

  it("shows the account opening balance fetched for the day before the from date", async () => {
    renderPage()
    expect(screen.getByLabelText("Account Opening Balance")).toHaveValue("")

    await loadTransactions()

    expect(screen.getByLabelText("Account Opening Balance")).toHaveValue(
      String(245000.5)
    )
  })

  it("swaps statement dates for reference dates when filtering by reference date", async () => {
    renderPage()
    await selectBankAccount()

    expect(screen.getByLabelText("From Date")).toBeInTheDocument()
    expect(screen.queryByLabelText("From Reference Date")).not.toBeInTheDocument()

    await user.click(screen.getByLabelText("Filter by Reference Date"))

    expect(await screen.findByLabelText("From Reference Date")).toBeInTheDocument()
    expect(screen.getByLabelText("To Reference Date")).toBeInTheDocument()
    expect(screen.queryByLabelText("From Date")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("To Date")).not.toBeInTheDocument()
  })
})
