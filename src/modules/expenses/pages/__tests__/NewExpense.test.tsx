import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import NewExpense from "../NewExpense"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { server, resetFixtures, lastRequest } from "@/mocks/server"

vi.mock("@/components/layout/Topbar", () => ({ default: () => null }))

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => resetFixtures())
afterAll(() => server.close())
afterEach(() => resetFixtures())

const user = userEvent.setup()

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/expenses/new"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <NewExpense />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("NewExpense page (M3.4 create flow)", () => {
  it("hydrates company/account/paid-from defaults from the company master", async () => {
    renderPage()

    const company = await screen.findByLabelText("Company")
    await waitFor(() => expect(company).not.toHaveValue(""))
    await waitFor(() => expect(screen.getByLabelText("Expense Account *")).not.toHaveValue(""))
    await waitFor(() => expect(screen.getByLabelText("Paid From (credit) *")).not.toHaveValue(""))
  })

  it("rejects a save without a description", async () => {
    renderPage()
    await screen.findByLabelText("Company")

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Description is required.")).toBeInTheDocument()
  })

  it("creates and submits an expense as a balanced Journal Entry", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByLabelText("Expense Account *")).not.toHaveValue(""))
    await waitFor(() => expect(screen.getByLabelText("Paid From (credit) *")).not.toHaveValue(""))

    const description = screen.getByLabelText("Description *")
    await user.type(description, "Conference tickets for Sarthak")

    const amount = screen.getByLabelText("Amount *")
    await user.clear(amount)
    await user.type(amount, "88.5")

    await user.click(screen.getByRole("button", { name: "Save & Submit" }))

    const saveReq = await waitFor(() => {
      const found = lastRequest((r) => r.method === "POST" && r.path.endsWith("frappe.desk.form.save.savedocs"))
      expect(found).toBeDefined()
      return found
    })
    const saveBody = saveReq?.body as Record<string, unknown>
    const doc = JSON.parse(String(saveBody.doc)) as Record<string, unknown>
    expect(saveBody.action).toBe("Save")
    expect(doc.doctype).toBe("Journal Entry")
    expect(doc.voucher_type).toBe("Journal Entry")
    expect(doc.total_debit).toBe(88.5)
    expect(doc.total_credit).toBe(88.5)

    await waitFor(() => {
      expect(
        lastRequest((r) => r.method === "PUT" && r.path === "/api/resource/Journal Entry/ACC-JV-2026-00006")
      ).toBeDefined()
    })
  })
})