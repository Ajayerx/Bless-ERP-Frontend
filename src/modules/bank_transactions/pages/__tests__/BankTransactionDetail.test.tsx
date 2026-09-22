import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import BankTransactionDetail from "../BankTransactionDetail"
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

const user = userEvent.setup()

function renderPage(name = "BT-2026-0001") {
  return render(
    <MemoryRouter initialEntries={[`/bank-transactions/${name}`]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/bank-transactions/:id" element={<BankTransactionDetail />} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("Bank Transaction detail", () => {
  it("renders the document fields and linked payment entries", async () => {
    renderPage()

    expect(await screen.findByText("BT-2026-0001")).toBeInTheDocument()
    expect(screen.getByLabelText("Description")).toHaveValue("AlphaCorp wire transfer")
    expect(screen.getByText("ACC-PAY-2026-00051")).toBeInTheDocument()
    expect(screen.getByLabelText("Bank Account")).toHaveValue("Cheque - BE")
  })

  it("unreconciles the transaction when Unreconcile Transaction is clicked", async () => {
    renderPage()
    await screen.findByText("ACC-PAY-2026-00051")

    await user.click(screen.getByRole("button", { name: /Unreconcile Transaction/i }))

    expect(await screen.findByText("Bank Transaction BT-2026-0001 unreconciled")).toBeInTheDocument()
    expect(screen.getByText("No linked payment entries")).toBeInTheDocument()
  })

  it("saves allow-on-submit fields (reference number)", async () => {
    renderPage()
    await screen.findByText("ACC-PAY-2026-00051")

    const refInput = screen.getByLabelText("Reference Number")
    await user.clear(refInput)
    await user.type(refInput, "WIRE-999")
    await user.click(screen.getByRole("button", { name: /Save/i }))

    expect(await screen.findByText("Bank Transaction saved")).toBeInTheDocument()
  })
})
