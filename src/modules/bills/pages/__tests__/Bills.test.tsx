import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import Bills from "../Bills"
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
    <MemoryRouter initialEntries={["/bills"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Bills />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function billsListReq() {
  return lastRequest((r) => r.method === "GET" && r.path === "/api/resource/Purchase Invoice")
}

async function rowFor(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name)
  return cell.closest("tr") as HTMLElement
}

describe("Bills list page (M3.3 ERPNext parity)", () => {
  it("renders bill rows with indicator badges and the fixture count", async () => {
    renderPage()

    await screen.findByText("ACC-PINV-2026-0007")
    expect(screen.getByText("ACC-PINV-2026-0001")).toBeInTheDocument()
    expect(within(await rowFor("ACC-PINV-2026-0001")).getAllByText("Northwind Foods").length).toBeGreaterThan(0)
    expect(within(await rowFor("ACC-PINV-2026-0001")).getByText("Draft")).toBeInTheDocument()
    expect(within(await rowFor("ACC-PINV-2026-0005")).getByText("Overdue")).toBeInTheDocument()
    expect(within(await rowFor("ACC-PINV-2026-0006")).getByText("Paid")).toBeInTheDocument()
    expect(within(await rowFor("ACC-PINV-2026-0007")).getByText("Overdue")).toBeInTheDocument()
    expect(within(await rowFor("ACC-PINV-2026-0008")).getByText("Cancelled")).toBeInTheDocument()

    expect(screen.getByText("9 bills")).toBeInTheDocument()
  })

  it("filters by the Draft pill (docstatus = 0)", async () => {
    renderPage()
    await screen.findByText("ACC-PINV-2026-0001")

    await user.click(screen.getByRole("button", { name: "Draft" }))

    await waitFor(() => {
      expect(String(billsListReq()?.query?.filters ?? "")).toContain(
        '["Purchase Invoice","docstatus","=",0]'
      )
    })
    expect(await screen.findByText("ACC-PINV-2026-0003")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("ACC-PINV-2026-0004")).not.toBeInTheDocument()
    })
    expect(screen.getByText("3 bills")).toBeInTheDocument()
  })

  it("submits a draft from the row action through the resource PUT", async () => {
    renderPage()
    await screen.findByText("ACC-PINV-2026-0001")

    await user.click(within(await rowFor("ACC-PINV-2026-0001")).getByTitle("Submit"))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Submit Bill")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))

    await waitFor(() => {
      expect(
        lastRequest((r) => r.method === "PUT" && r.path === "/api/resource/Purchase Invoice/ACC-PINV-2026-0001")
      ).toBeDefined()
    })
    await waitFor(() => {
      expect(screen.queryByText("Submit Bill")).not.toBeInTheDocument()
    })
  })

  it("cancels a submitted bill from the row action", async () => {
    renderPage()
    await screen.findByText("ACC-PINV-2026-0004")

    await user.click(within(await rowFor("ACC-PINV-2026-0004")).getByTitle("Cancel"))

    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByText("Permanently cancel ACC-PINV-2026-0004? This action cannot be undone.")
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Cancel Bill" }))

    const req = await waitFor(() => {
      const found = lastRequest(
        (r) => r.method === "POST" && r.path.endsWith("frappe.desk.form.save.cancel")
      )
      expect(found).toBeDefined()
      return found
    })
    const body = req?.body as Record<string, unknown>
    expect(body.doctype).toBe("Purchase Invoice")
    expect(body.name).toBe("ACC-PINV-2026-0004")
  })
})