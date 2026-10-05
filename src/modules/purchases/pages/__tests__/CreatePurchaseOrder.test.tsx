import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import CreatePurchaseOrder from "../CreatePurchaseOrder"
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
    <MemoryRouter initialEntries={["/purchases/new"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/purchases/new" element={<CreatePurchaseOrder />} />
            <Route path="/purchases/:id" element={<div>PO_DETAIL_PAGE</div>} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

async function addItem(itemCode: string) {
  const itemCell = screen.getByTestId("purchase-order-items_0_item_code")
  await user.click(itemCell)
  const input = within(itemCell).getByPlaceholderText("Search item…")
  await user.type(input, itemCode)
  await user.click(await screen.findByRole("button", { name: new RegExp(itemCode) }, { timeout: 3000 }))
}

describe("CreatePurchaseOrder form (M3.2)", () => {
  it("renders the new PO form with required header fields", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "New Purchase Order" })).toBeInTheDocument()
    expect(screen.getByText("Supplier *")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Select supplier…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save & Submit" })).toBeInTheDocument()
  })

  it("blocks save until at least one item is added", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Purchase Order" })

    await user.click(screen.getByRole("button", { name: /Save Draft/ }))
    expect(await screen.findByText("Add at least one item before saving.")).toBeInTheDocument()
  })

  it("blocks save until a supplier is picked", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Purchase Order" })

    await addItem("PRD-001")

    await user.click(screen.getByRole("button", { name: /Save Draft/ }))
    expect(await screen.findByText("Supplier is required.")).toBeInTheDocument()
  })

  it("saves a draft with a picked supplier + item and navigates to its detail page", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Purchase Order" })

    const supplierInput = screen.getByPlaceholderText("Select supplier…")
    await user.click(supplierInput)
    await user.type(supplierInput, "SUP-00001")
    await user.click(await screen.findByRole("button", { name: /Northwind Foods/ }, { timeout: 3000 }))

    await addItem("PRD-001")

    await user.click(screen.getByRole("button", { name: /Save Draft/ }))

    const req = await waitFor(() => {
      const found = lastRequest(
        (r) => r.method === "POST" && r.path.endsWith("frappe.desk.form.save.savedocs")
      )
      expect(found).toBeDefined()
      return found
    })
    const body = req?.body as Record<string, unknown>
    expect(body.action).toBe("Save")
    const payload = JSON.parse(String(body.doc)) as Record<string, unknown>
    expect(payload.doctype).toBe("Purchase Order")
    expect(payload.company).toBe("Bless Erp")
    expect(payload.currency).toBe("CAD")
    expect(payload.supplier).toBe("SUP-00001")
    const items = payload.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(items[0].item_code).toBe("PRD-001")

    expect(await screen.findByText("PO_DETAIL_PAGE")).toBeInTheDocument()
  })
})