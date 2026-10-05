import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import BankAccounts from "../BankAccounts"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { server, resetFixtures, lastRequest } from "@/mocks/server"

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
    <MemoryRouter initialEntries={["/bank-accounts"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/bank-accounts" element={<BankAccounts />} />
            <Route path="/bank-accounts/new" element={<div>NEW_PAGE</div>} />
            <Route path="/bank-accounts/:id" element={<div>DETAIL_PAGE</div>} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("BankAccounts list (M3.5)", () => {
  it("renders the bank account rows from the fixture set", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "Bank Accounts" })).toBeInTheDocument()
    expect(await screen.findByText("Cheque - BE")).toBeInTheDocument()
    expect(screen.getAllByText("Business Chequing", { selector: "p" }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Savings - RBC/)).toBeInTheDocument()
    expect(screen.getByText(/AlphaCorp CAD - BMO/)).toBeInTheDocument()
    expect(screen.getByText(/Northwind Foods - BMO/)).toBeInTheDocument()
  })

  it("shows total count from the get_count endpoint", async () => {
    renderPage()
    await waitFor(() => {
      const req = lastRequest((r) => r.path === "/api/method/frappe.client.get_count")
      expect(req).toBeDefined()
    })
    expect(await screen.findByText("6", { selector: ".text-2xl" })).toBeInTheDocument()
  })

  it("filters by the Disabled pill", async () => {
    renderPage()
    await screen.findByText("Cheque - BE")

    await user.click(screen.getByRole("button", { name: "Disabled" }))

    expect(await screen.findByText(/Northwind Foods - BMO/)).toBeInTheDocument()
    expect(screen.queryByText(/Cheque - BE/)).not.toBeInTheDocument()
  })

  it("searches accounts by name", async () => {
    renderPage()
    await screen.findByText("Cheque - BE")

    await user.type(screen.getByPlaceholderText("Search bank accounts..."), "savings")

    expect(await screen.findByText(/Savings - RBC/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(/Cheque - BE/)).not.toBeInTheDocument()
    })
  })

  it("navigates to the New Bank Account page from Add Account", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "Bank Accounts" })

    await user.click(screen.getByRole("button", { name: /Add Account/ }))

    expect(await screen.findByText("NEW_PAGE")).toBeInTheDocument()
  })

  it("opens the account detail when a row is clicked", async () => {
    renderPage()
    const name = await screen.findByText("Cheque - BE")
    const row = name.closest("tr")
    expect(row).not.toBeNull()

    await user.click(row as HTMLElement)

    expect(await screen.findByText("DETAIL_PAGE")).toBeInTheDocument()
  })
})