import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import NewSupplier from "../NewSupplier"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { server, resetFixtures, lastRequest } from "@/mocks/server"

vi.mock("@/components/layout/Topbar", () => ({ default: () => null }))

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => {
  resetFixtures()
})
afterAll(() => server.close())
afterEach(() => {
  resetFixtures()
  vi.restoreAllMocks()
})

const user = userEvent.setup()

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/suppliers/new"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/suppliers/new" element={<NewSupplier />} />
            <Route path="/suppliers/:id" element={<div>SUPPLIER_DETAIL_PAGE</div>} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("NewSupplier form (M3.1)", () => {
  it("renders the form with the required name and group fields", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "New Supplier" })).toBeInTheDocument()
    expect(screen.getByLabelText("Supplier Name *")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Select supplier group...")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Create Supplier/ })).toBeInTheDocument()
  })

  it("blocks submit until supplier name and group are provided", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Supplier" })

    await user.click(screen.getByRole("button", { name: /Create Supplier/ }))
    expect(await screen.findByText("Supplier name is required.")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Supplier Name *"), "Bulk Foods Inc.")
    await user.click(screen.getByRole("button", { name: /Create Supplier/ }))
    expect(await screen.findByText("Supplier group is required.")).toBeInTheDocument()
  })

  it("creates a supplier with a selected group and navigates to its detail page", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Supplier" })

    await user.type(screen.getByLabelText("Supplier Name *"), "Bulk Foods Inc.")

    await user.click(screen.getByPlaceholderText("Select supplier group..."))
    await user.click(await screen.findByRole("button", { name: /Distributor/ }))

    await user.click(screen.getByRole("button", { name: /Create Supplier/ }))

    const created = await waitFor(() => {
      const req = lastRequest((r) => r.method === "POST" && r.path === "/api/resource/Supplier")
      expect(req).toBeDefined()
      return req
    })
    const body = created?.body as Record<string, unknown>
    expect(body.supplier_name).toBe("Bulk Foods Inc.")
    expect(body.supplier_group).toBe("Distributor")

    expect(await screen.findByText("SUPPLIER_DETAIL_PAGE")).toBeInTheDocument()
  })
})