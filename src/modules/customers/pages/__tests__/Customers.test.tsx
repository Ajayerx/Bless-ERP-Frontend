import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import Customers from "../Customers"
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
    (r) => r.path === "/api/resource/Customer" && r.method === "GET" && r.query.limit_page_length !== "0"
  )
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/customers"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Customers />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function renderPageWithQuery(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/customers${query}`]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Customers />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("Customers list page (ERPNext parity)", () => {
  it("renders customer rows with status badges and the FilterGroup", async () => {
    renderPage()

    await screen.findByText("Maple Leaf Bakery")
    expect(screen.getByText("Blue Mountain Supplies")).toBeInTheDocument()
    // Status pill tabs render before the row badges, but both exist.
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Disabled").length).toBeGreaterThan(0)
    // ERPNext-style filter bar + advanced FilterGroup funnel button.
    expect(screen.getByRole("button", { name: "Advanced Filter" })).toBeInTheDocument()
    expect(screen.getByLabelText("ID")).toBeInTheDocument()
  })

  it("filters by ID in the always-visible inline bar (like)", async () => {
    renderPage()
    await screen.findByText("Maple Leaf Bakery")

    await user.type(screen.getByLabelText("ID"), "CUST-00008")

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Customer","name","like","%CUST-00008%"]'
      )
    })
    await waitFor(() => {
      expect(screen.queryByText("Maple Leaf Bakery")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Eastern Seafood Co.")).toBeInTheDocument()

    await user.clear(screen.getByLabelText("ID"))
    await waitFor(() => {
      expect(screen.getByText("Maple Leaf Bakery")).toBeInTheDocument()
    })
  })

  it("drives the status filter from the quick pills (Active → disabled = 0)", async () => {
    renderPage()
    await screen.findByText("Maple Leaf Bakery")

    // The first "Active" button is the quick pill (row badges follow).
    const activePill = screen.getAllByRole("button", { name: "Active" })[0]
    await user.click(activePill)

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Customer","disabled","=",0]'
      )
    })
    // Manitoba Harvest Co-op is the only disabled fixture customer.
    await waitFor(() => {
      expect(screen.queryByText("Manitoba Harvest Co-op")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Maple Leaf Bakery")).toBeInTheDocument()
  })

  it("row status badges map Frozen → is_frozen = 1 (empty list for fixtures)", async () => {
    renderPage()
    await screen.findByText("Maple Leaf Bakery")

    const frozenPill = screen.getAllByRole("button", { name: "Frozen" })[0]
    await user.click(frozenPill)

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Customer","is_frozen","=",1]'
      )
    })
    // No fixture customer is frozen → the list is empty under the active filter.
    await waitFor(() => {
      expect(screen.getByText("No customers match the current filters.")).toBeInTheDocument()
    })
  })

  it("filters by Type from the inline select (Company drops Individuals)", async () => {
    renderPage()
    await screen.findByText("Sarah Williams")

    await user.click(screen.getByRole("button", { name: "Type" }))
    await user.click(await screen.findByRole("button", { name: "Company" }))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Customer","customer_type","=","Company"]'
      )
    })
    await waitFor(() => {
      expect(screen.queryByText("Sarah Williams")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Blue Mountain Supplies")).toBeInTheDocument()
  })

  it("filters by Customer Name from a list cell click (ERPNext .filterable cells)", async () => {
    renderPage()
    await screen.findByText("Blue Mountain Supplies")

    await user.click(screen.getByText("Blue Mountain Supplies"))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Customer","customer_name","=","Blue Mountain Supplies"]'
      )
    })
    await waitFor(() => {
      expect(screen.queryByText("Maple Leaf Bakery")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Blue Mountain Supplies")).toBeInTheDocument()
  })

  it("adds an advanced filter via the FilterGroup popover (market_segment = Enterprise)", async () => {
    renderPage()
    await screen.findByText("Summit Logistics")

    await user.click(screen.getByRole("button", { name: "Advanced Filter" }))
    await user.click(await screen.findByRole("button", { name: /Add a Filter/ }))
    await user.selectOptions(await screen.findByLabelText("Filter field"), "market_segment")
    await user.type(screen.getByLabelText("Filter value"), "Enterprise")
    await user.click(screen.getByRole("button", { name: /Apply/ }))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Customer","market_segment","=","Enterprise"]'
      )
    })
    await waitFor(() => {
      // Vancouver Island Brewery is Mid-Market → filtered out; Summit stays.
      expect(screen.queryByText("Vancouver Island Brewery")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Summit Logistics")).toBeInTheDocument()
  })

  it("seeds the advanced filter popover from active URL filters", async () => {
    renderPageWithQuery(
      `?filters=${encodeURIComponent(
        JSON.stringify([{ field: "market_segment", label: "Segment", operator: "=", value: "Enterprise" }])
      )}`
    )
    await screen.findByText("Summit Logistics")

    await user.click(screen.getByRole("button", { name: "Advanced Filter" }))
    await waitFor(() => {
      expect(screen.getByLabelText("Filter field")).toHaveValue("market_segment")
    })
    expect(screen.getByLabelText("Filter value")).toHaveValue("Enterprise")
  })

  it("restores filters and sort from the URL query string", async () => {
    const query =
      "?filters=" +
      encodeURIComponent(
        JSON.stringify([{ field: "name", label: "ID", operator: "like", value: "CUST-00008" }])
      ) +
      "&sort=name%20asc"
    renderPageWithQuery(query)
    await screen.findByText("Eastern Seafood Co.")

    expect(screen.getByLabelText("ID")).toHaveValue("CUST-00008")

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain(
        '["Customer","name","like","%CUST-00008%"]'
      )
      expect(String(listReq()?.query?.order_by ?? "").toUpperCase()).toContain("NAME ASC")
    })
  })

  it("clears every filter from the inline bar with Clear all", async () => {
    renderPage()
    await screen.findByText("Maple Leaf Bakery")

    await user.type(screen.getByLabelText("ID"), "CUST-00008")
    await waitFor(() => {
      expect(screen.getByText("Eastern Seafood Co.")).toBeInTheDocument()
    })
    await user.click(screen.getByText("Clear all"))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toBe("")
    })
    expect(screen.getByLabelText("ID")).toHaveValue("")
    await waitFor(() => {
      expect(screen.getByText("Maple Leaf Bakery")).toBeInTheDocument()
    })
  })
})