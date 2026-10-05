import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import CreateBill from "../CreateBill"
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
    <MemoryRouter initialEntries={["/bills/new"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/bills/new" element={<CreateBill />} />
            <Route path="/bills/:id" element={<div>BILL_DETAIL_PAGE</div>} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

async function pickSupplier(code: string, label: string) {
  const supplierInput = screen.getByPlaceholderText("Select supplier…")
  await user.click(supplierInput)
  await user.type(supplierInput, code)
  await user.click(await screen.findByRole("button", { name: new RegExp(label) }, { timeout: 3000 }))
}

async function addItem(itemCode: string) {
  const itemCell = screen.getByTestId("purchase-invoice-items_0_item_code")
  await user.click(itemCell)
  const input = within(itemCell).getByPlaceholderText("Search item…")
  await user.type(input, itemCode)
  await user.click(await screen.findByRole("button", { name: new RegExp(itemCode) }, { timeout: 3000 }))
}

describe("CreateBill form (M3.3)", () => {
  it("renders the new bill form with required header fields", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "New Bill" })).toBeInTheDocument()
    expect(screen.getByText("Supplier *")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Select supplier…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save & Submit" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Get Items From Purchase Order/ })).toBeInTheDocument()
  })

  it("blocks save until at least one item is added", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Bill" })

    await user.click(screen.getByRole("button", { name: /Save Draft/ }))
    expect(await screen.findByText("Add at least one item before saving.")).toBeInTheDocument()
  })

  it("blocks save until a supplier is picked", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Bill" })

    await addItem("PRD-001")

    await user.click(screen.getByRole("button", { name: /Save Draft/ }))
    expect(await screen.findByText("Supplier is required.")).toBeInTheDocument()
  })

  it("Gets items from a purchase order through make_mapped_doc and pre-fills the form", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Bill" })

    await user.click(screen.getByRole("button", { name: /Get Items From Purchase Order/ }))
    const dialog = await screen.findByRole("dialog")
    const poInput = within(dialog).getByPlaceholderText("Search purchase orders…")
    await user.click(poInput)
    await user.type(poInput, "PUR-ORD-2026-0001")
    await user.click(await screen.findByRole("button", { name: /PUR-ORD-2026-0001/ }, { timeout: 3000 }))

    await user.click(within(dialog).getByRole("button", { name: /Get Items/ }))

    const req = await waitFor(() => {
      const found = lastRequest(
        (r) => r.method === "POST" && r.path === "/api/method/frappe.model.mapper.make_mapped_doc"
      )
      expect(found).toBeDefined()
      return found
    })
    const body = (req?.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>
    expect(body.source_name).toBe("PUR-ORD-2026-0001")
    expect(String(body.method)).toContain("make_purchase_invoice")

    await waitFor(() => {
      expect(within(screen.getByTestId("purchase-invoice-items_0_item_code")).getByText("PRD-001")).toBeInTheDocument()
    })
    expect(within(screen.getByTestId("purchase-invoice-items_0_item_name")).getByText("Organic All-Purpose Flour")).toBeInTheDocument()
    expect(within(screen.getByTestId("purchase-invoice-items_2_item_code")).getByText("PRD-008")).toBeInTheDocument()
  })

  it("saves a draft via savedocs with supplier + item and navigates to the detail page", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Bill" })

    await pickSupplier("SUP-00001", "Northwind Foods")
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
    expect(payload.doctype).toBe("Purchase Invoice")
    expect(payload.company).toBe("Bless Erp")
    expect(payload.currency).toBe("CAD")
    expect(payload.supplier).toBe("SUP-00001")
    const items = payload.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(items[0].item_code).toBe("PRD-001")

    expect(await screen.findByText("BILL_DETAIL_PAGE")).toBeInTheDocument()
  })
})