import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import NewJournalEntry from "../NewJournalEntry"
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
    <MemoryRouter initialEntries={["/journal-entries/new"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/journal-entries/new" element={<NewJournalEntry />} />
            <Route path="/journal-entries/:id" element={<div>SAVED_DETAIL</div>} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("NewJournalEntry form (M3.6 composer)", () => {
  it("rejects a save with no account lines", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Journal Entry" })

    await user.click(screen.getByRole("button", { name: /Save$/i }))

    expect(await screen.findByText("Add at least one account line before saving.")).toBeInTheDocument()
  })

  it("auto-balances the last row and submits a draft as a balanced Journal Entry", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Journal Entry" })

    await user.type(screen.getByPlaceholderText("Bill / reference no…"), "REF-2026-88")
    await user.type(screen.getByPlaceholderText("e.g. Main - BE"), "Main - BE")
    await user.type(screen.getByPlaceholderText("Auto-generated from remark…"), "Conference for Sarthak")

    await user.click(screen.getByTestId("je-accounts_0_account"))
    const accountInput = screen.getByPlaceholderText("Search account…")
    await user.click(accountInput)
    await user.click(await screen.findByRole("button", { name: /Cash - BE/ }))

    const debit = within(screen.getByTestId("je-accounts_0_debit")).getByRole("spinbutton")
    await user.clear(debit)
    await user.type(debit, "120")

    await user.click(screen.getByRole("button", { name: "+ Auto-Balance" }))

    await waitFor(() =>
      expect(within(screen.getByTestId("je-accounts_0_credit")).getByDisplayValue("120")).toBeDefined()
    )

    await user.click(screen.getByRole("button", { name: "Save & Submit" }))

    const saveReq = await waitFor(() => {
      const found = lastRequest((r) => r.method === "POST" && r.path.endsWith("savedocs"))
      expect(found).toBeDefined()
      return found
    })
    const body = saveReq?.body as Record<string, unknown>
    const doc = JSON.parse(String(body.doc)) as Record<string, unknown>
    expect(body.action).toBe("Submit")
    expect(doc.voucher_type).toBe("Journal Entry")
    expect(doc.finance_book).toBe("Main - BE")
    expect(doc.bill_no).toBe("REF-2026-88")
    expect(doc.total_debit).toBe(120)
    expect(doc.total_credit).toBe(120)
    expect(doc.difference).toBe(0)

    expect(await screen.findByText("SAVED_DETAIL")).toBeInTheDocument()
  })

  it("surfaces an unbalanced-entry error before saving", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Journal Entry" })

    await user.click(screen.getByTestId("je-accounts_0_account"))
    const accountInput = screen.getByPlaceholderText("Search account…")
    await user.click(accountInput)
    await user.click(await screen.findByRole("button", { name: /Operating Expenses - BE/ }))

    const debit = within(screen.getByTestId("je-accounts_0_debit")).getByRole("spinbutton")
    await user.clear(debit)
    await user.type(debit, "2500")

    await user.click(screen.getByRole("button", { name: /Save$/i }))

    expect(
      await screen.findByText(/Journal Entry is not balanced\./)
    ).toBeInTheDocument()
    expect(screen.queryByText("SAVED_DETAIL")).not.toBeInTheDocument()
  })
})