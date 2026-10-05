import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import PurchaseDetail from "../PurchaseDetail"
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

function renderPage(id = "PUR-ORD-2026-0005") {
  return render(
    <MemoryRouter initialEntries={[`/purchases/${id}`]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/purchases/:id" element={<PurchaseDetail />} />
            <Route path="/purchases/:id/edit" element={<div>EDIT_PAGE</div>} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("PurchaseDetail workflow (M3.2 workflow actions)", () => {
  it("shows workflow buttons for a submitted PO based on per_received / per_billed", async () => {
    renderPage()
    await screen.findByText("PUR-ORD-2026-0005")

    expect(screen.getByRole("button", { name: /Edit/ })).toBeDisabled()
    expect(screen.queryByRole("button", { name: /Submit/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Amend/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Delete/ })).toBeInTheDocument()

    expect(screen.queryByRole("button", { name: /Make Purchase Receipt/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Make Purchase Invoice/ })).toBeInTheDocument()
  })

  it("Amend creates a new draft via savedocs and navigates to its edit page", async () => {
    renderPage()
    await screen.findByText("PUR-ORD-2026-0005")

    await user.click(screen.getByRole("button", { name: /Amend/ }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Amend Purchase Order")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Amend" }))

    expect(await screen.findByText("EDIT_PAGE")).toBeInTheDocument()

    const req = lastRequest((r) => r.method === "POST" && r.path === "/api/method/frappe.desk.form.save.savedocs")
    expect(req).toBeDefined()
    const body = (req?.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>
    expect(body.action).toBe("Save")
    const doc = JSON.parse(String(body.doc ?? "{}")) as Record<string, unknown>
    expect(doc.amended_from).toBe("PUR-ORD-2026-0005")
    expect(doc.docstatus).toBe(0)
    expect(doc.doctype).toBe("Purchase Order")
  })

  it("Make Purchase Invoice fires the mapped-doc mapper for the source PO", async () => {
    renderPage()
    await screen.findByText("PUR-ORD-2026-0005")

    await user.click(screen.getByRole("button", { name: /Make Purchase Invoice/ }))

    const req = lastRequest(
      (r) => r.method === "POST" && r.path === "/api/method/frappe.model.mapper.make_mapped_doc"
    )
    await waitFor(() => expect(req).toBeDefined())
    const body = (req?.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>
    expect(body.method).toBe("erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_invoice")
    expect(body.source_name).toBe("PUR-ORD-2026-0005")
    expect(await screen.findByText(/Purchase Invoice draft created from PUR-ORD-2026-0005/)).toBeInTheDocument()
  })

  it("More menu surfaces Print and Email actions", async () => {
    renderPage()
    await screen.findByText("PUR-ORD-2026-0005")

    await user.click(screen.getByRole("button", { name: "More actions" }))
    await user.click(await screen.findByRole("menuitem", { name: /Print/ }))
    expect(await screen.findByText("Print not available yet.")).toBeInTheDocument()
  })
})