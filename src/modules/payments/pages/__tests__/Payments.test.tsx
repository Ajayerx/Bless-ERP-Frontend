import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import Payments from "../Payments"
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
    (r) => r.path === "/api/resource/Payment Entry" && r.method === "GET" && r.query.limit_page_length !== "0"
  )
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/payments"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Payments />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function renderPageWithQuery(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/payments${query}`]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Payments />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("Payments list page (ERPNext parity)", () => {
  it("renders payment rows with status badges and the FilterGroup", async () => {
    renderPage()

    await screen.findByText("PAY-2026-0001")
    expect(screen.getByText("PAY-2026-0002")).toBeInTheDocument()
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0)
    // ERPNext-style filter bar + advanced FilterGroup funnel button.
    expect(screen.getByRole("button", { name: "Advanced Filter" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Party")).toBeInTheDocument()
  })

  it("filters by ID in the always-visible inline bar (like)", async () => {
    renderPage()
    await screen.findByText("PAY-2026-0001")

    await user.type(screen.getByLabelText("ID"), "PAY-2026-0008")

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Payment Entry","name","like","%PAY-2026-0008%"]'
      )
    })
    await waitFor(() => {
      expect(screen.queryByText("PAY-2026-0001")).not.toBeInTheDocument()
    })
    expect(screen.getByText("PAY-2026-0008")).toBeInTheDocument()

    await user.clear(screen.getByLabelText("ID"))
    await waitFor(() => {
      expect(screen.getByText("PAY-2026-0001")).toBeInTheDocument()
    })
  })

  it("drives the status filter from the quick pills (mapped to docstatus)", async () => {
    renderPage()
    await screen.findByText("PAY-2026-0001")

    // The first "Submitted" button is the quick pill (row badges follow).
    const submittedPill = screen.getAllByRole("button", { name: "Submitted" })[0]
    await user.click(submittedPill)

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Payment Entry","docstatus","=",1]'
      )
    })
    // Payment Entry has no `status` field on the row — status lives on docstatus,
    // so every Submitted row stays under the pill.
    expect(screen.getByText("PAY-2026-0001")).toBeInTheDocument()
  })

  it("filters by Status from the inline select (Draft → docstatus 0, empty list)", async () => {
    renderPage()
    await screen.findByText("PAY-2026-0001")

    await user.click(screen.getByRole("button", { name: "Status" }))
    // The inline Status select exposes the same options as the quick pills
    // (which are always rendered), so pick the row inside the popover.
    const options = await screen.findAllByRole("button", { name: "Draft" })
    await user.click(options[options.length - 1])

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Payment Entry","docstatus","=",0]'
      )
    })
    expect(screen.getByRole("button", { name: "Status" })).toHaveTextContent("Draft")
    // No fixture payment is a draft → the list is empty under the active filter.
    await waitFor(() => {
      expect(screen.getByText("No payments match the current filters.")).toBeInTheDocument()
    })
  })

  it("filters by Party from a list cell click (ERPNext .filterable cells)", async () => {
    renderPage()
    await screen.findByText("PAY-2026-0001")

    // "Blue Mountain Supplies" (CUST-0003) is shared by PAY-2026-0003 and 0006.
    const partyCell = screen.getAllByText("Blue Mountain Supplies")[0]
    await user.click(partyCell)

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Payment Entry","party","=","CUST-0003"]'
      )
    })
    await waitFor(() => {
      expect(screen.queryByText("PAY-2026-0001")).not.toBeInTheDocument()
    })
    expect(screen.getByText("PAY-2026-0006")).toBeInTheDocument()
  })

  it("adds an advanced filter via the FilterGroup popover (paid_amount >= 4000)", async () => {
    renderPage()
    await screen.findByText("PAY-2026-0001")

    await user.click(screen.getByRole("button", { name: "Advanced Filter" }))
    await user.click(await screen.findByRole("button", { name: /Add a Filter/ }))
    await user.selectOptions(await screen.findByLabelText("Filter field"), "paid_amount")
    await user.selectOptions(screen.getByLabelText("Filter condition"), ">=")
    await user.type(screen.getByLabelText("Filter value"), "4000")
    await user.click(screen.getByRole("button", { name: /Apply/ }))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Payment Entry","paid_amount",">=","4000"]'
      )
    })
    await waitFor(() => {
      // 2450.00 < 4000 → filtered out; 4300.00 stays.
      expect(screen.queryByText("PAY-2026-0001")).not.toBeInTheDocument()
    })
    expect(screen.getByText("PAY-2026-0007")).toBeInTheDocument()
  })

  it("seeds the advanced filter popover from active URL filters", async () => {
    renderPageWithQuery(
      `?filters=${encodeURIComponent(
        JSON.stringify([{ field: "status", label: "Status", operator: "=", value: "Submitted" }])
      )}`
    )
    await screen.findByText("PAY-2026-0001")

    await user.click(screen.getByRole("button", { name: "Advanced Filter" }))
    await waitFor(() => {
      expect(screen.getByLabelText("Filter field")).toHaveValue("status")
    })
    expect(screen.getByLabelText("Filter value")).toHaveValue("Submitted")
  })

  it("restores filters and sort from the URL query string", async () => {
    const query =
      "?filters=" +
      encodeURIComponent(
        JSON.stringify([{ field: "name", label: "ID", operator: "like", value: "PAY-2026-0008" }])
      ) +
      "&sort=paid_amount%20asc"
    renderPageWithQuery(query)
    await screen.findByText("PAY-2026-0008")

    expect(screen.getByLabelText("ID")).toHaveValue("PAY-2026-0008")

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Payment Entry","name","like","%PAY-2026-0008%"]'
      )
      expect(String(listReq()?.query?.order_by ?? "").toUpperCase()).toContain("PAID_AMOUNT ASC")
    })
  })

  it("clears every filter from the inline bar with Clear all", async () => {
    renderPage()
    await screen.findByText("PAY-2026-0001")

    await user.type(screen.getByLabelText("ID"), "PAY-2026-0008")
    await waitFor(() => {
      expect(screen.getByText("PAY-2026-0008")).toBeInTheDocument()
    })
    await user.click(screen.getByText("Clear all"))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toBe("")
    })
    expect(screen.getByLabelText("ID")).toHaveValue("")
    await waitFor(() => {
      expect(screen.getByText("PAY-2026-0001")).toBeInTheDocument()
    })
  })
})