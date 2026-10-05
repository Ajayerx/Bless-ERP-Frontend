import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import BankAccountDetail from "../BankAccountDetail"
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
    <MemoryRouter initialEntries={["/bank-accounts/Cheque%20-%20BE"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/bank-accounts/:id" element={<BankAccountDetail />} />
            <Route path="/bank-accounts" element={<div>LIST_PAGE</div>} />
            <Route path="/bank-accounts/:id/edit" element={<div>EDIT_PAGE</div>} />
            <Route path="/bank-reconciliation" element={<div>RECON_PAGE</div>} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("BankAccountDetail (M3.5)", () => {
  it("renders the real ERPNext fields and badges", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "Business Chequing" })).toBeInTheDocument()
    expect(screen.getAllByText("Cheque - BE").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Company Account").length).toBeGreaterThan(0)
    expect(screen.getByText("Default")).toBeInTheDocument()
    expect(screen.getByText("Enabled")).toBeInTheDocument()
    expect(screen.getByText("Royal Bank of Canada")).toBeInTheDocument()
    expect(screen.getByText("Bless Erp")).toBeInTheDocument()
    expect(screen.getByText("0048-4192-1133")).toBeInTheDocument()
  })

  it("shows linked bank transactions for the account", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "Business Chequing" })

    expect(await screen.findByText("Linked Bank Transactions")).toBeInTheDocument()
    const rows = await screen.findAllByText(/AlphaCorp wire transfer/)
    expect(rows.length).toBeGreaterThan(0)
  })

  it("links to the reconciliation tool", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "Business Chequing" })

    await user.click(screen.getByRole("button", { name: /Open Reconciliation/ }))
    expect(await screen.findByText("RECON_PAGE")).toBeInTheDocument()
  })

  it("navigates to edit", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "Business Chequing" })

    await user.click(screen.getByRole("button", { name: /Edit/ }))
    expect(await screen.findByText("EDIT_PAGE")).toBeInTheDocument()
  })

  it("deletes the account after confirmation", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "Business Chequing" })

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0])
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: "Delete" })[1])

    await waitFor(() => {
      const req = lastRequest((r) => r.method === "DELETE" && r.path.includes("/api/resource/Bank Account/"))
      expect(req).toBeDefined()
    })
    expect(await screen.findByText("LIST_PAGE")).toBeInTheDocument()
  })
})