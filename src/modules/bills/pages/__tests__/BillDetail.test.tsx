import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import BillDetail from "../BillDetail"
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
    <MemoryRouter initialEntries={[`/bills/${id}`]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/bills/:id" element={<BillDetail />} />
            <Route path="/bills/:id/edit" element={<div>EDIT_PAGE</div>} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("BillDetail workflow (M3.3 workflow actions)", () => {
  it("shows Submit/Delete for a draft bill with Edit enabled", async () => {
    renderPage("ACC-PINV-2026-0001")
    await screen.findByRole("heading", { name: "ACC-PINV-2026-0001" })

    expect(screen.getByRole("button", { name: /Edit/ })).toBeEnabled()
    expect(screen.getByRole("button", { name: /Submit/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Cancel/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Amend/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Delete/ })).toBeInTheDocument()
  })

  it("shows Cancel/Amend/Delete for a submitted bill with Edit disabled", async () => {
    renderPage("ACC-PINV-2026-0004")
    await screen.findByRole("heading", { name: "ACC-PINV-2026-0004" })

    expect(screen.getByRole("button", { name: /Edit/ })).toBeDisabled()
    expect(screen.queryByRole("button", { name: /Submit/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Amend/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Delete/ })).toBeInTheDocument()
  })

  it("submits a draft bill through the resource PUT", async () => {
    renderPage("ACC-PINV-2026-0001")
    await screen.findByRole("heading", { name: "ACC-PINV-2026-0001" })

    await user.click(screen.getByRole("button", { name: /Submit/ }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Submit Bill")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))

    const req = await waitFor(() => {
      const found = lastRequest(
        (r) => r.method === "PUT" && r.path === "/api/resource/Purchase Invoice/ACC-PINV-2026-0001"
      )
      expect(found).toBeDefined()
      return found
    })
    expect(((req?.body ?? {}) as Record<string, unknown>).docstatus).toBe(1)
  })

  it("Amend creates a new draft via savedocs and navigates to its edit page", async () => {
    renderPage("ACC-PINV-2026-0004")
    await screen.findByRole("heading", { name: "ACC-PINV-2026-0004" })

    await user.click(screen.getByRole("button", { name: /Amend/ }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Amend Bill")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Amend" }))

    expect(await screen.findByText("EDIT_PAGE")).toBeInTheDocument()

    const req = lastRequest((r) => r.method === "POST" && r.path === "/api/method/frappe.desk.form.save.savedocs")
    expect(req).toBeDefined()
    const body = (req?.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>
    expect(body.action).toBe("Save")
    const doc = JSON.parse(String(body.doc ?? "{}")) as Record<string, unknown>
    expect(doc.amended_from).toBe("ACC-PINV-2026-0004")
    expect(doc.docstatus).toBe(0)
    expect(doc.doctype).toBe("Purchase Invoice")
  })

  it("More menu surfaces Print and Email actions", async () => {
    renderPage("ACC-PINV-2026-0004")
    await screen.findByRole("heading", { name: "ACC-PINV-2026-0004" })

    await user.click(screen.getByRole("button", { name: "More actions" }))
    await user.click(await screen.findByRole("menuitem", { name: /Print/ }))
    expect(await screen.findByText("Print not available yet.")).toBeInTheDocument()
  })
})