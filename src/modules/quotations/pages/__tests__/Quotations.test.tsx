import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import Quotations from "../Quotations"
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
    (r) => r.path === "/api/resource/Quotation" && r.method === "GET" && r.query.limit_page_length !== "0"
  )
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/quotations"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Quotations />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function renderPageWithQuery(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/quotations${query}`]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Quotations />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("Quotations list page (ERPNext parity)", () => {
  it("renders quotation rows with status badges and the FilterGroup", async () => {
    renderPage()

    await screen.findByText("SAL-QTN-2026-0001")
    expect(screen.getByText("SAL-QTN-2026-0002")).toBeInTheDocument()
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0)
    // ERPNext-style filter bar + advanced FilterGroup funnel button.
    expect(screen.getByRole("button", { name: "Advanced Filter" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Party")).toBeInTheDocument()
  })

  it("filters by ID in the always-visible inline bar (like)", async () => {
    renderPage()
    await screen.findByText("SAL-QTN-2026-0001")

    await user.type(screen.getByLabelText("ID"), "SAL-QTN-2026-0005")

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Quotation","name","like","%SAL-QTN-2026-0005%"]'
      )
    })
    await waitFor(() => {
      expect(screen.queryByText("SAL-QTN-2026-0001")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SAL-QTN-2026-0005")).toBeInTheDocument()

    await user.clear(screen.getByLabelText("ID"))
    await waitFor(() => {
      expect(screen.getByText("SAL-QTN-2026-0001")).toBeInTheDocument()
    })
  })

  it("drives the status filter from the quick pills", async () => {
    renderPage()
    await screen.findByText("SAL-QTN-2026-0001")

    await user.click(screen.getByRole("button", { name: "Open" }))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Quotation","status","=","Open"]'
      )
    })
    await waitFor(() => {
      // "Ordered" quotation disappears under the Open pill.
      expect(screen.queryByText("SAL-QTN-2026-0003")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SAL-QTN-2026-0001")).toBeInTheDocument()
  })

  it("adds an advanced filter via the FilterGroup popover (grand_total >= 2000)", async () => {
    renderPage()
    await screen.findByText("SAL-QTN-2026-0001")

    await user.click(screen.getByRole("button", { name: "Advanced Filter" }))
    await user.click(await screen.findByRole("button", { name: /Add a Filter/ }))
    await user.selectOptions(await screen.findByLabelText("Filter field"), "grand_total")
    await user.selectOptions(screen.getByLabelText("Filter condition"), ">=")
    await user.type(screen.getByLabelText("Filter value"), "2000")
    await user.click(screen.getByRole("button", { name: /Apply/ }))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Quotation","grand_total",">=","2000"]'
      )
    })
    await waitFor(() => {
      // 1890.50 < 2000 → filtered out; 2450.00 stays.
      expect(screen.queryByText("SAL-QTN-2026-0002")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SAL-QTN-2026-0001")).toBeInTheDocument()
  })

  it("seeds the advanced filter popover from active URL filters", async () => {
    renderPageWithQuery(
      `?filters=${encodeURIComponent(
        JSON.stringify([{ field: "name", label: "ID", operator: "=", value: "SAL-QTN-2026-0001" }])
      )}`
    )
    await screen.findByText("SAL-QTN-2026-0001")

    await user.click(screen.getByRole("button", { name: "Advanced Filter" }))
    await waitFor(() => {
      expect(screen.getByLabelText("Filter field")).toHaveValue("name")
    })
    expect(screen.getByLabelText("Filter value")).toHaveValue("SAL-QTN-2026-0001")
  })

  it("restores filters and sort from the URL query string", async () => {
    const query =
      "?filters=" +
      encodeURIComponent(
        JSON.stringify([{ field: "name", label: "ID", operator: "like", value: "SAL-QTN-2026-0005" }])
      ) +
      "&sort=grand_total%20asc"
    renderPageWithQuery(query)
    await screen.findByText("SAL-QTN-2026-0005")

    expect(screen.getByLabelText("ID")).toHaveValue("SAL-QTN-2026-0005")

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Quotation","name","like","%SAL-QTN-2026-0005%"]'
      )
      expect(String(listReq()?.query?.order_by ?? "").toUpperCase()).toContain("GRAND_TOTAL ASC")
    })
  })

  it("clears every filter from the inline bar with Clear all", async () => {
    renderPage()
    await screen.findByText("SAL-QTN-2026-0001")

    await user.type(screen.getByLabelText("ID"), "SAL-QTN-2026-0005")
    await waitFor(() => {
      expect(screen.getByText("SAL-QTN-2026-0005")).toBeInTheDocument()
    })
    await user.click(screen.getByText("Clear all"))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toBe("")
    })
    expect(screen.getByLabelText("ID")).toHaveValue("")
    await waitFor(() => {
      expect(screen.getByText("SAL-QTN-2026-0001")).toBeInTheDocument()
    })
  })

  it("searches Party against the doctype chosen in Quotation To (ERPNext Dynamic Link parity)", async () => {
    renderPage()
    await screen.findByText("SAL-QTN-2026-0001")
    const partyInput = screen.getByPlaceholderText("Party")
    const searchFor = (txt: string) =>
      lastRequest(
        (r) =>
          r.path === "/api/method/frappe.desk.search.search_link" &&
          String(r.body?.txt ?? "").startsWith(txt)
      )

    // No quotation_to selected → get_options() returns "" → no request, no results.
    await user.type(partyInput, "LEAD")
    await waitFor(() => {
      expect(screen.getByText("No results found")).toBeInTheDocument()
    })
    expect(searchFor("LEAD")).toBeUndefined()
    await user.clear(partyInput)

    // Lead → party_name search targets the Lead doctype only.
    await user.click(screen.getByLabelText("Quotation To"))
    await user.click(screen.getByRole("button", { name: "Lead" }))
    await user.type(screen.getByPlaceholderText("Party"), "LEAD")
    await waitFor(() => {
      expect(searchFor("LEAD")).toBeTruthy()
    })
    expect(String(searchFor("LEAD")?.body?.doctype ?? "")).toBe("Lead")

    // Back to Customer → search targets the Customer doctype.
    await user.click(screen.getByLabelText("Quotation To"))
    await user.click(screen.getByRole("button", { name: "Customer" }))
    await user.clear(screen.getByPlaceholderText("Party"))
    await user.type(screen.getByPlaceholderText("Party"), "Alph")
    await waitFor(() => {
      expect(searchFor("Alph")).toBeTruthy()
    })
    expect(String(searchFor("Alph")?.body?.doctype ?? "")).toBe("Customer")
  })
})