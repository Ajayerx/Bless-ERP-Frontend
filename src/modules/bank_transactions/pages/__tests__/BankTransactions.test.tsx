import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import BankTransactions from "../BankTransactions"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { server, resetFixtures, bankReconState } from "@/mocks/server"

vi.mock("@/components/layout/Topbar", () => ({ default: () => null }))

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => {
  resetFixtures()
  const first = bankReconState.transactions.find((t) => t.name === "BT-2026-0001")
  if (first) {
    first.payment_entries = [
      { payment_document: "Payment Entry", payment_entry: "ACC-PAY-2026-00051", allocated_amount: 1500 },
    ]
    first.allocated_amount = 1500
    first.status = "Reconciled"
  }
})
afterAll(() => server.close())
afterEach(() => {
  resetFixtures()
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/bank-transactions"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <BankTransactions />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("Bank Transactions list", () => {
  it("lists every bank transaction with its status", async () => {
    renderPage()

    expect(await screen.findByText("AlphaCorp wire transfer")).toBeInTheDocument()
    expect(screen.getByText("VendorOne outgoing payment")).toBeInTheDocument()
    expect(screen.getByText("Bank service charges")).toBeInTheDocument()
    // Three unreconciled fixtures + one reconciled fixture.
    expect(screen.getAllByText("Unreconciled").length).toBeGreaterThanOrEqual(3)
  })

  it("filters the list by status", async () => {
    renderPage()
    await screen.findByText("VendorOne outgoing payment")

    await userEvent.selectOptions(screen.getByLabelText("Status"), "Reconciled")

    await waitFor(() => expect(screen.queryByText("VendorOne outgoing payment")).toBeNull())
    expect(screen.getByText("AlphaCorp wire transfer")).toBeInTheDocument()
  })
})
