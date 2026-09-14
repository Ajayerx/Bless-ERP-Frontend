import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import Invoices from "../Invoices"
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

function listReq() {
  return lastRequest(
    (r) => r.path === "/api/resource/Sales Invoice" && r.method === "GET" && r.query.limit_page_length !== "0"
  )
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/invoices"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Invoices />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function renderPageWithQuery(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/invoices${query}`]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Invoices />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("Invoices list page (ERPNext parity)", () => {
  it("renders invoice rows with status badges and the FilterGroup", async () => {
    renderPage()

    await screen.findByText("SINV-2026-0001")
    expect(screen.getByText("SINV-2026-0002")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Paid" })).toBeInTheDocument()
    // ERPNext-style filter bar + advanced FilterGroup funnel button.
    expect(screen.getByRole("button", { name: "Advanced Filter" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Customer")).toBeInTheDocument()
  })

  it("filters by ID in the always-visible inline bar (like)", async () => {
    renderPage()
    await screen.findByText("SINV-2026-0001")

    await user.type(screen.getByLabelText("ID"), "SINV-2026-0005")

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Sales Invoice","name","like","%SINV-2026-0005%"]'
      )
    })
    await waitFor(() => {
      expect(screen.queryByText("SINV-2026-0001")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SINV-2026-0005")).toBeInTheDocument()

    await user.clear(screen.getByLabelText("ID"))
    await waitFor(() => {
      expect(screen.getByText("SINV-2026-0001")).toBeInTheDocument()
    })
  })

  it("drives the status filter from the quick pills", async () => {
    renderPage()
    await screen.findByText("SINV-2026-0001")

    await user.click(screen.getByRole("button", { name: "Paid" }))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Sales Invoice","status","=","Paid"]'
      )
    })
    await waitFor(() => {
      // Unpaid invoice disappears under the Paid pill.
      expect(screen.queryByText("SINV-2026-0002")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SINV-2026-0001")).toBeInTheDocument()
  })

  it("filters by Status from the inline select", async () => {
    renderPage()
    await screen.findByText("SINV-2026-0001")

    await user.click(screen.getByRole("button", { name: "Status" }))
    // The inline Status select exposes the same options as the quick pills
    // (which are always rendered), so pick the row inside the popover.
    const options = await screen.findAllByRole("button", { name: "Overdue" })
    await user.click(options[options.length - 1])

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Sales Invoice","status","=","Overdue"]'
      )
    })
    // The dropdown trigger reflects the chosen value.
    expect(screen.getByRole("button", { name: "Status" })).toHaveTextContent("Overdue")
    await waitFor(() => {
      expect(screen.queryByText("SINV-2026-0001")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SINV-2026-0005")).toBeInTheDocument()
  })

  it("adds an advanced filter via the FilterGroup popover (grand_total >= 2000)", async () => {
    renderPage()
    await screen.findByText("SINV-2026-0001")

    await user.click(screen.getByRole("button", { name: "Advanced Filter" }))
    await user.click(await screen.findByRole("button", { name: /Add a Filter/ }))
    await user.selectOptions(await screen.findByLabelText("Filter field"), "grand_total")
    await user.selectOptions(screen.getByLabelText("Filter condition"), ">=")
    await user.type(screen.getByLabelText("Filter value"), "2000")
    await user.click(screen.getByRole("button", { name: /Apply/ }))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Sales Invoice","grand_total",">=","2000"]'
      )
    })
    await waitFor(() => {
      // 1890.50 < 2000 → filtered out; 2450.00 stays.
      expect(screen.queryByText("SINV-2026-0002")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SINV-2026-0001")).toBeInTheDocument()
  })

  it("seeds the advanced filter popover from active URL filters", async () => {
    renderPageWithQuery(
      `?filters=${encodeURIComponent(
        JSON.stringify([{ field: "status", label: "Status", operator: "=", value: "Overdue" }])
      )}`
    )
    await screen.findByText("SINV-2026-0005")

    await user.click(screen.getByRole("button", { name: "Advanced Filter" }))
    await waitFor(() => {
      expect(screen.getByLabelText("Filter field")).toHaveValue("status")
    })
    expect(screen.getByLabelText("Filter value")).toHaveValue("Overdue")
  })

  it("restores filters and sort from the URL query string", async () => {
    const query =
      "?filters=" +
      encodeURIComponent(
        JSON.stringify([{ field: "name", label: "ID", operator: "like", value: "SINV-2026-0005" }])
      ) +
      "&sort=grand_total%20asc"
    renderPageWithQuery(query)
    await screen.findByText("SINV-2026-0005")

    expect(screen.getByLabelText("ID")).toHaveValue("SINV-2026-0005")

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Sales Invoice","name","like","%SINV-2026-0005%"]'
      )
      expect(String(listReq()?.query?.order_by ?? "").toUpperCase()).toContain("GRAND_TOTAL ASC")
    })
  })

  it("clears every filter from the inline bar with Clear all", async () => {
    renderPage()
    await screen.findByText("SINV-2026-0001")

    await user.type(screen.getByLabelText("ID"), "maple")
    await user.click(screen.getByText("Clear all"))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toBe("")
    })
    expect(screen.getByLabelText("ID")).toHaveValue("")
    await waitFor(() => {
      expect(screen.getByText("SINV-2026-0001")).toBeInTheDocument()
    })
  })
})