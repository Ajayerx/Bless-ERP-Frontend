import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import Purchases from "../Purchases"
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
    <MemoryRouter initialEntries={["/purchases"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Purchases />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function purchaseOrderListReq() {
  return lastRequest((r) => r.method === "GET" && r.path === "/api/resource/Purchase Order")
}

async function rowFor(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name)
  return cell.closest("tr") as HTMLElement
}

describe("Purchases list page (M3.2 ERPNext parity)", () => {
  it("renders purchase order rows with status badges and the fixture count", async () => {
    renderPage()

    await screen.findByText("PUR-ORD-2026-0003")
    expect(screen.getByText("PUR-ORD-2026-0001")).toBeInTheDocument()
    expect(within(await rowFor("PUR-ORD-2026-0001")).getAllByText("Northwind Foods").length).toBeGreaterThan(0)
    expect(within(await rowFor("PUR-ORD-2026-0001")).getByText("Draft")).toBeInTheDocument()
    expect(within(await rowFor("PUR-ORD-2026-0007")).getByText("Completed")).toBeInTheDocument()
    expect(within(await rowFor("PUR-ORD-2026-0009")).getByText("Cancelled")).toBeInTheDocument()

    expect(screen.getByText("9 purchase orders")).toBeInTheDocument()
  })

  it("filters by the Draft pill (docstatus = 0)", async () => {
    renderPage()
    await screen.findByText("PUR-ORD-2026-0001")

    await user.click(screen.getByRole("button", { name: "Draft" }))

    await waitFor(() => {
      expect(String(purchaseOrderListReq()?.query?.filters ?? "")).toContain(
        '["Purchase Order","docstatus","=",0]'
      )
    })
    expect(await screen.findByText("PUR-ORD-2026-0003")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("PUR-ORD-2026-0004")).not.toBeInTheDocument()
    })
    expect(screen.getByText("3 purchase orders")).toBeInTheDocument()
  })

  it("submits a draft from the row action through the resource PUT", async () => {
    renderPage()
    await screen.findByText("PUR-ORD-2026-0001")

    await user.click(within(await rowFor("PUR-ORD-2026-0001")).getByTitle("Submit"))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Submit Purchase Order")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))

    await waitFor(() => {
      expect(
        lastRequest((r) => r.method === "PUT" && r.path === "/api/resource/Purchase Order/PUR-ORD-2026-0001")
      ).toBeDefined()
    })
    await waitFor(() => {
      expect(screen.queryByText("Submit Purchase Order")).not.toBeInTheDocument()
    })
  })

  it("cancels a submitted order from the row action", async () => {
    renderPage()
    await screen.findByText("PUR-ORD-2026-0004")

    await user.click(within(await rowFor("PUR-ORD-2026-0004")).getByTitle("Cancel"))

    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByText("Permanently cancel PUR-ORD-2026-0004? This action cannot be undone.")
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Cancel Purchase Order" }))

    const req = await waitFor(() => {
      const found = lastRequest(
        (r) => r.method === "POST" && r.path.endsWith("frappe.desk.form.save.cancel")
      )
      expect(found).toBeDefined()
      return found
    })
    const body = req?.body as Record<string, unknown>
    expect(body.doctype).toBe("Purchase Order")
    expect(body.name).toBe("PUR-ORD-2026-0004")
  })
})