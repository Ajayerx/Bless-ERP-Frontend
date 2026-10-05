import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import ExpenseDetail from "../ExpenseDetail"
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

function renderPage(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/expenses/${id}`]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/expenses/:id" element={<ExpenseDetail />} />
            <Route path="/expenses/:id/edit" element={<div>EDIT_PAGE</div>} />
            <Route path="/expenses" element={<div>EXPENSES_LIST</div>} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("ExpenseDetail workflow (M3.4 detail actions)", () => {
  it("renders a submitted expense JE with the accounts grid and GL link", async () => {
    renderPage("ACC-JV-2026-00001")
    await screen.findByRole("heading", { name: "Office supplies for Q3" })

    expect(screen.getByText("ACC-JV-2026-00001 · Journal Entry")).toBeInTheDocument()
    expect(screen.getByText("Submitted")).toBeInTheDocument()
    expect(screen.getAllByText("$2,500.00").length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText("Operating Expenses - BE").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Cash - BE").length).toBeGreaterThanOrEqual(1)

    const gl = screen.getByText("View in General Ledger").closest("a") as HTMLAnchorElement
    expect(gl.href).toContain("/reports/general-ledger?voucher_type=Journal%20Entry&voucher_no=ACC-JV-2026-00001")
  })

  it("shows Edit/Submit/Delete for a draft expense and hides Submit after it is submitted", async () => {
    renderPage("ACC-JV-2026-00002")
    await screen.findByRole("heading", { name: "Accounting consultation - Deloitte LLP" })

    expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Submit/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Amend/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Cancel/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Submit/i }))

    await waitFor(() => {
      expect(
        lastRequest((r) => r.method === "PUT" && r.path === "/api/resource/Journal Entry/ACC-JV-2026-00002")
      ).toBeDefined()
    })
    expect(await screen.findByText("Submitted")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Submit/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Amend/i })).toBeInTheDocument()
  })

  it("shows Amend/Cancel for a submitted expense and cancels it", async () => {
    renderPage("ACC-JV-2026-00001")
    await screen.findByText("ACC-JV-2026-00001 · Journal Entry")

    expect(screen.getByRole("button", { name: /Amend/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Delete/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Cancel/i }))

    await waitFor(() => {
      expect(
        lastRequest((r) => r.method === "POST" && r.path.endsWith("frappe.desk.form.save.cancel"))
      ).toBeDefined()
    })
    expect(await screen.findByText("Cancelled")).toBeInTheDocument()
  })

  it("navigates into the edit page then back to the list from the draft toolbar", async () => {
    renderPage("ACC-JV-2026-00002")
    await screen.findByRole("heading", { name: "Accounting consultation - Deloitte LLP" })

    await user.click(screen.getByRole("button", { name: /Edit/i }))
    expect(await screen.findByText("EDIT_PAGE")).toBeInTheDocument()

    renderPage("ACC-JV-2026-00002")
    await screen.findByRole("heading", { name: "Accounting consultation - Deloitte LLP" })
    await user.click(screen.getByRole("button", { name: /Delete/i }))
    expect(await screen.findByText("EXPENSES_LIST")).toBeInTheDocument()
  })
})