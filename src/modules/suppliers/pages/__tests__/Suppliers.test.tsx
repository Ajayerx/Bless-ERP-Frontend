import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import Suppliers from "../Suppliers"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { server, resetFixtures, lastRequest } from "@/mocks/server"

vi.mock("@/components/layout/Topbar", () => ({ default: () => null }))

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => {
  resetFixtures()
  const url = URL as unknown as { createObjectURL?: () => string; revokeObjectURL?: () => void }
  if (!url.createObjectURL) url.createObjectURL = () => "blob:mock-export"
  if (!url.revokeObjectURL) url.revokeObjectURL = () => {}
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
})
afterAll(() => server.close())
afterEach(() => {
  resetFixtures()
  vi.restoreAllMocks()
})

const user = userEvent.setup()

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/suppliers"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Suppliers />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function supplierListReq() {
  return lastRequest((r) => r.method === "GET" && r.path === "/api/resource/Supplier")
}

async function rowFor(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name)
  return cell.closest("tr") as HTMLElement
}

// The total counter lives on the summary card ("Total Suppliers" + count).
function totalSuppliersText() {
  return "Total Suppliers"
}

describe("Suppliers list page (M3.1 ERPNext parity)", () => {
  it("renders supplier rows with status badges and the fixture count", async () => {
    renderPage()

    await screen.findByText("Northwind Foods")
    expect(screen.getByText("SUP-00001")).toBeInTheDocument()
    expect(within(await rowFor("Northwind Foods")).getByText("Active")).toBeInTheDocument()
    expect(within(await rowFor("Great Lakes Packaging")).getByText("On Hold")).toBeInTheDocument()
    expect(within(await rowFor("Pacific Coast Seafood")).getByText("Disabled")).toBeInTheDocument()

    expect(screen.getByText(totalSuppliersText())).toBeInTheDocument()
  })

  it("filters by the On Hold pill (on_hold = 1)", async () => {
    renderPage()
    await screen.findByText("Northwind Foods")

    await user.click(screen.getByRole("button", { name: "On Hold" }))

    await waitFor(() => {
      expect(String(supplierListReq()?.query?.filters ?? "")).toContain(
        '["Supplier","on_hold","=",1]'
      )
    })
    expect(await screen.findByText("Great Lakes Packaging")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("Northwind Foods")).not.toBeInTheDocument()
    })
  })

  it("filters by the Disabled pill (disabled = 1)", async () => {
    renderPage()
    await screen.findByText("Pacific Coast Seafood")

    await user.click(screen.getByRole("button", { name: "Disabled" }))

    await waitFor(() => {
      expect(String(supplierListReq()?.query?.filters ?? "")).toContain(
        '["Supplier","disabled","=",1]'
      )
    })
    expect(await screen.findByText("Eastern Paper Mills")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("Great Lakes Packaging")).not.toBeInTheDocument()
    })
  })

  it("searches suppliers by name through the like filter", async () => {
    renderPage()
    await screen.findByText("Northwind Foods")

    await user.type(screen.getByPlaceholderText("Search suppliers..."), "seafood")

    await waitFor(() => {
      expect(String(supplierListReq()?.query?.filters ?? "")).toContain(
        '["Supplier","supplier_name","like","%seafood%"]'
      )
    })
    await waitFor(() => {
      expect(screen.queryByText("Northwind Foods")).not.toBeInTheDocument()
      expect(screen.getByText("Pacific Coast Seafood")).toBeInTheDocument()
    })
  })

  it("deletes a selected supplier through reportview.delete_items", async () => {
    renderPage()
    await screen.findByText("Northwind Foods")

    const row = await rowFor("Northwind Foods")
    await user.click(within(row).getByRole("checkbox"))

    await user.click(await screen.findByRole("button", { name: /Actions/ }))
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(/Are you sure you want to delete/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Delete Supplier" }))

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path.endsWith("reportview.delete_items") && r.method === "POST"
      )
      expect(req).toBeDefined()
      const body = req?.body as Record<string, unknown>
      expect(body.doctype).toBe("Supplier")
      expect(body.items).toBe(JSON.stringify(["SUP-00001"]))
    })
    await waitFor(() => {
      expect(screen.queryByText("Northwind Foods")).not.toBeInTheDocument()
    })
  })

  it("exports a selected supplier through the server-side download_template", async () => {
    renderPage()
    await screen.findByText("Great Lakes Packaging")

    const row = await rowFor("Great Lakes Packaging")
    await user.click(within(row).getByRole("checkbox"))

    await user.click(await screen.findByRole("button", { name: /Actions/ }))
    await user.click(await screen.findByRole("menuitem", { name: "Export" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Export Suppliers")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Export" }))

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path.endsWith("data_import.data_import.download_template") && r.method === "POST"
      )
      expect(req).toBeDefined()
      const body = req?.body as Record<string, unknown>
      expect(body.doctype).toBe("Supplier")
      expect(body.file_type).toBe("CSV")
      expect(body.export_records).toBe("by_filter")
      expect(JSON.parse(String(body.export_fields))["Supplier"]).toContain("supplier_name")
      expect(String(body.export_filters)).toContain("SUP-00002")
    })
  })
})