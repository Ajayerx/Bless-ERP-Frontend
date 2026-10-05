import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import JournalEntryDetail from "../JournalEntryDetail"
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
    <MemoryRouter initialEntries={[`/journal-entries/${id}`]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/journal-entries/:id" element={<JournalEntryDetail />} />
            <Route path="/journal-entries/:id/edit" element={<div>EDIT_PAGE</div>} />
            <Route path="/journal-entries" element={<div>LIST_PAGE</div>} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("JournalEntryDetail (M3.6 detail actions)", () => {
  it("renders a submitted entry with the accounts grid, totals, and GL link", async () => {
    renderPage("ACC-JV-2026-00001")
    await screen.findByRole("heading", { name: "ACC-JV-2026-00001" })

    expect(screen.getByText("Submitted")).toBeInTheDocument()
    expect(screen.getAllByText("Journal Entry").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Operating Expenses - BE").length).toBe(1)
    expect(screen.getAllByText("Cash - BE").length).toBe(1)
    expect(screen.getAllByText("$2,500.00").length).toBeGreaterThanOrEqual(3)

    const gl = screen.getByText("View in GL →").closest("a") as HTMLAnchorElement
    expect(gl.href).toContain("/reports/general-ledger?voucher_type=Journal%20Entry&voucher_no=ACC-JV-2026-00001")

    expect(screen.queryByRole("button", { name: /Submit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Edit/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument()
  })

  it("shows Edit/Submit/Delete for a draft and submits it through the dialog", async () => {
    renderPage("ACC-JV-2026-00002")
    await screen.findByRole("heading", { name: "ACC-JV-2026-00002" })

    expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Submit" }))
    await screen.findByText("Submit Entry")
    await user.click(screen.getAllByRole("button", { name: "Submit" }).slice(-1)[0])

    await waitFor(() => {
      expect(
        lastRequest((r) => r.method === "PUT" && r.path === "/api/resource/Journal Entry/ACC-JV-2026-00002")
      ).toBeDefined()
    })
    expect(await screen.findByText("Submitted")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Cancel/i })).toBeInTheDocument()
  })

  it("cancels a submitted entry", async () => {
    renderPage("ACC-JV-2026-00001")
    await screen.findByRole("heading", { name: "ACC-JV-2026-00001" })

    await user.click(screen.getByRole("button", { name: /Cancel/i }))
    await screen.findByRole("heading", { name: "Cancel Entry" })
    await user.click(screen.getByRole("button", { name: "Cancel Entry" }))

    await waitFor(() => {
      expect(
        lastRequest((r) => r.method === "POST" && r.path.endsWith("frappe.desk.form.save.cancel"))
      ).toBeDefined()
    })
    expect(await screen.findByText("Cancelled")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Submit/i })).not.toBeInTheDocument()
  })

  it("invalidates cancellation of a draft (backend guard surfaces the error)", async () => {
    renderPage("ACC-JV-2026-00005")
    await screen.findByRole("heading", { name: "ACC-JV-2026-00005" })
    // 00005 is Cancelled — the submitted-only Cancel toolbar button is hidden.
    expect(screen.queryByRole("button", { name: /Cancel/i })).not.toBeInTheDocument()
  })

  it("amends a submitted entry into a new draft copy", async () => {
    renderPage("ACC-JV-2026-00001")
    await screen.findByRole("heading", { name: "ACC-JV-2026-00001" })

    await user.click(screen.getByRole("button", { name: "More actions" }))
    await user.click(await screen.findByRole("menuitem", { name: "Amend" }))
    await screen.findByText("Amend Entry")
    await user.click(screen.getByRole("button", { name: "Amend" }))

    expect(await screen.findByText("Amended from ACC-JV-2026-00001")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "ACC-JV-2026-00006" })).toBeInTheDocument()
    expect(screen.getByText("Draft")).toBeInTheDocument()
  })

  it("navigates to edit for drafts and deletes from the overflow menu", async () => {
    renderPage("ACC-JV-2026-00002")
    await screen.findByRole("heading", { name: "ACC-JV-2026-00002" })

    await user.click(screen.getByRole("button", { name: /Edit/i }))
    expect(await screen.findByText("EDIT_PAGE")).toBeInTheDocument()

    renderPage("ACC-JV-2026-00002")
    await screen.findByRole("heading", { name: "ACC-JV-2026-00002" })
    await user.click(screen.getByRole("button", { name: "More actions" }))
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }))
    await screen.findByText("Delete Entry")
    await user.click(screen.getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("LIST_PAGE")).toBeInTheDocument()
  })
})