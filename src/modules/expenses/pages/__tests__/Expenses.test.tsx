import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import Expenses from "../Expenses"
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
    <MemoryRouter initialEntries={["/expenses"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Expenses />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function listReq() {
  return lastRequest((r) => r.method === "GET" && r.path === "/api/resource/Journal Entry")
}

async function rowFor(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name)
  return cell.closest("tr") as HTMLElement
}

describe("Expenses list page (M3.4 JE-backed)", () => {
  it("renders expense-type JEs with badge + totals and excludes non-expense JEs", async () => {
    renderPage()

    await screen.findByText("ACC-JV-2026-00001")
    expect(screen.getByText("ACC-JV-2026-00002")).toBeInTheDocument()
    expect(within(await rowFor("ACC-JV-2026-00001")).getByText("Submitted")).toBeInTheDocument()
    expect(within(await rowFor("ACC-JV-2026-00002")).getByText("Draft")).toBeInTheDocument()
    expect(within(await rowFor("ACC-JV-2026-00005")).getByText("Cancelled")).toBeInTheDocument()
    expect(within(await rowFor("ACC-JV-2026-00001")).getByText("$2,500.00")).toBeInTheDocument()
    expect(screen.queryByText("ACC-JV-2026-00004")).not.toBeInTheDocument()

    expect(screen.getByText("4 transactions")).toBeInTheDocument()
  })

  it("filters by status through the child-filtered resource query", async () => {
    renderPage()
    await screen.findByText("ACC-JV-2026-00001")

    await user.click(screen.getByRole("button", { name: "Submitted" }))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain('["Journal Entry","docstatus","=",1]')
      expect(String(listReq()?.query?.filters ?? "")).toContain('"accounts","account","in"')
    })
    expect(await screen.findByText("ACC-JV-2026-00003")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("ACC-JV-2026-00002")).not.toBeInTheDocument()
    })
    expect(screen.getByText("2 transactions")).toBeInTheDocument()
  })

  it("searches with the OR group", async () => {
    renderPage()
    await screen.findByText("ACC-JV-2026-00001")

    await user.type(screen.getByPlaceholderText("Search expenses..."), "fuel")

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain('%fuel%')
    })
    expect(await screen.findByText("ACC-JV-2026-00005")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("ACC-JV-2026-00001")).not.toBeInTheDocument()
    })
    expect(screen.getByText("1 transactions")).toBeInTheDocument()
  })

  it("bulk submits a selected draft expense", async () => {
    renderPage()
    await screen.findByText("ACC-JV-2026-00002")

    await user.click(within(await rowFor("ACC-JV-2026-00002")).getByRole("checkbox"))
    expect(screen.getByText("1 expenses selected")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Actions/ }))
    await user.click(await screen.findByRole("menuitem", { name: "Submit" }))

    expect(screen.getByText("Submit 1 expenses")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Submit" }))

    await waitFor(() => {
      const req = lastRequest((r) =>
        r.method === "POST" && r.path.endsWith("bulk_update.submit_cancel_or_update_docs")
      )
      expect(String((req?.body as Record<string, unknown>)?.docnames)).toContain("ACC-JV-2026-00002")
    })
    expect(within(await rowFor("ACC-JV-2026-00002")).getByText("Submitted")).toBeInTheDocument()
  })

  it("bulk cancels selected submitted expenses", async () => {
    renderPage()
    await screen.findByText("ACC-JV-2026-00001")

    await user.click(within(await rowFor("ACC-JV-2026-00001")).getByRole("checkbox"))
    await user.click(within(await rowFor("ACC-JV-2026-00003")).getByRole("checkbox"))
    expect(screen.getByText("2 expenses selected")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Actions/ }))
    await user.click(await screen.findByRole("menuitem", { name: "Cancel" }))

    expect(screen.getByText("Cancel 2 expenses")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Cancel Expense" }))

    await waitFor(() => {
      const req = lastRequest((r) =>
        r.method === "POST" && r.path.endsWith("bulk_update.submit_cancel_or_update_docs")
      )
      expect(String((req?.body as Record<string, unknown>)?.action)).toBe("cancel")
    })
    expect(within(await rowFor("ACC-JV-2026-00001")).getByText("Cancelled")).toBeInTheDocument()
    expect(within(await rowFor("ACC-JV-2026-00003")).getByText("Cancelled")).toBeInTheDocument()
  })

  it("bulk deletes a selected draft expense", async () => {
    renderPage()
    await screen.findByText("ACC-JV-2026-00002")

    await user.click(within(await rowFor("ACC-JV-2026-00002")).getByRole("checkbox"))

    await user.click(screen.getByRole("button", { name: /Actions/ }))
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }))

    expect(screen.getByText("Delete 1 expenses")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(
        lastRequest((r) => r.method === "POST" && r.path.endsWith("reportview.delete_items"))
      ).toBeDefined()
    })
    await waitFor(() => {
      expect(screen.queryByText("ACC-JV-2026-00002")).not.toBeInTheDocument()
    })
    expect(screen.getByText("3 transactions")).toBeInTheDocument()
  })

  it("exports the filtered expenses via download_template", async () => {
    renderPage()
    await screen.findByText("ACC-JV-2026-00001")

    await user.click(screen.getByRole("button", { name: "Draft" }))
    await screen.findByText("ACC-JV-2026-00002")

    await user.click(within(await rowFor("ACC-JV-2026-00002")).getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: /Actions/ }))
    await user.click(await screen.findByRole("menuitem", { name: "Export" }))

    expect(screen.getByText("Export Expenses")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Export$/ }))

    await waitFor(() => {
      const req = lastRequest((r) => r.method === "POST" && r.path.endsWith("download_template"))
      expect(req).toBeDefined()
      expect(String((req?.body as Record<string, unknown>)?.doctype)).toBe("Journal Entry")
    })
  })

  it("filters by company and posting date range", async () => {
    renderPage()
    await screen.findByText("ACC-JV-2026-00001")

    const companyInput = screen.getByPlaceholderText("Company")
    await user.click(companyInput)
    await user.type(companyInput, "Bless")
    await user.click(await screen.findByRole("button", { name: /Bless Erp/i }, { timeout: 3000 }))
    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain('"Journal Entry","company","=","Bless Erp"')
    })

    await user.type(screen.getByLabelText("Posting Date From"), "2026-09-01")
    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain('"Journal Entry","posting_date",">=","2026-09-01"')
    })

    await user.type(screen.getByLabelText("Posting Date To"), "2026-09-30")
    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain('"Journal Entry","posting_date","<=","2026-09-30"')
    })
  })
})