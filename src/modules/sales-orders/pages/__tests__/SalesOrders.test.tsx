import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"
import { http, HttpResponse } from "msw"

import SalesOrders from "../SalesOrders"
import { SalesOrderDetailWorkspace } from "../SalesOrderWorkspace"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { AuthProvider } from "@/context/AuthContext"
import { CompanyProvider } from "@/context/CompanyContext"
import { server, resetFixtures, lastRequest, capturedRequests } from "@/mocks/server"
import { salesOrders } from "@/mocks/handlers/frappe-lookups"

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
    <MemoryRouter initialEntries={["/sales-orders"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <SalesOrders />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function renderPageWithQuery(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/sales-orders${query}`]}>
      <ToastProvider>
        <MessageDialogProvider>
          <SalesOrders />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function renderWorkspace(name: string) {
  return render(
    <MemoryRouter initialEntries={[`/sales-orders/${name}`]}>
      <AuthProvider>
        <CompanyProvider>
          <ToastProvider>
            <MessageDialogProvider>
              <Routes>
                <Route path="/sales-orders/:id" element={<SalesOrderDetailWorkspace />} />
              </Routes>
            </MessageDialogProvider>
          </ToastProvider>
        </CompanyProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

async function rowFor(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name)
  return cell.closest("tr") as HTMLElement
}

async function selectRows(names: string[]): Promise<void> {
  for (const name of names) {
    const row = await rowFor(name)
    await user.click(within(row).getByRole("checkbox"))
  }
}

async function openActions(): Promise<void> {
  await user.click(await screen.findByRole("button", { name: /Actions/ }))
}

// The load-more counter ("20 of 30") is composed of nested <span>s, so the
// default text matcher (direct text nodes only) never sees it. Match the exact
// outer span by textContent instead.
function byCounter(text: string) {
  return (_: string, node: Element | null) =>
    node?.tagName === "SPAN" && node?.textContent === text
}

describe("SalesOrders list page (ERPNext parity)", () => {
  it("renders rows with raw ERPNext status badges and docstatus-driven actions", async () => {
    renderPage()

    // Submitted, past-due, under-delivered rows derive the ERPNext "Overdue"
    // indicator (sales_order_list.js get_indicator); the stored status literal
    // only drives the underlying doc semantics.
    await screen.findByText("SAL-ORD-2026-0001")
    expect(screen.getAllByText("Overdue").length).toBeGreaterThanOrEqual(3)
    expect(within(await rowFor("SAL-ORD-2026-0001")).getByText("Overdue")).toBeInTheDocument()
    expect(within(await rowFor("SAL-ORD-2026-0004")).getByText("Completed")).toBeInTheDocument()
    // Draft row surfaces the docstatus short-circuit badge, not the stored status.
    expect(within(await rowFor("SAL-ORD-2026-0005")).getByText("Draft")).toBeInTheDocument()
    // Cancelled row shows the derived indicator badge.
    expect(within(await rowFor("SAL-ORD-2026-0006")).getAllByText("Cancelled")).toHaveLength(1)

    // Draft row: Submit + Delete action buttons only.
    const draftRow = await rowFor("SAL-ORD-2026-0005")
    expect(within(draftRow).getByTitle("Submit")).toBeInTheDocument()
    expect(within(draftRow).getByTitle("Delete")).toBeInTheDocument()
    expect(within(draftRow).queryByTitle("Cancel")).not.toBeInTheDocument()
    expect(within(draftRow).queryByTitle("Amend")).not.toBeInTheDocument()

    // Submitted row: Cancel only.
    const submittedRow = await rowFor("SAL-ORD-2026-0001")
    expect(within(submittedRow).getByTitle("Cancel")).toBeInTheDocument()
    expect(within(submittedRow).queryByTitle("Submit")).not.toBeInTheDocument()

    // Cancelled row: Amend + Delete only.
    const cancelledRow = await rowFor("SAL-ORD-2026-0006")
    expect(within(cancelledRow).getByTitle("Amend")).toBeInTheDocument()
    expect(within(cancelledRow).getByTitle("Delete")).toBeInTheDocument()
    expect(within(cancelledRow).queryByTitle("Cancel")).not.toBeInTheDocument()
  })

  it("gates bulk actions by the selected docstatus mix", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0005")

    // Only a Draft row selected â†’ Submit + Delete, but no Cancel / Amend / Close.
    await selectRows(["SAL-ORD-2026-0005"])
    expect(screen.getByText("1 sales orders selected")).toBeInTheDocument()
    await openActions()
    expect(await screen.findByRole("menuitem", { name: "Submit" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Cancel" })).not.toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Close" })).not.toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Amend" })).not.toBeInTheDocument()

    // Closing the menu and adding a submitted row brings in Cancel and Close.
    await user.keyboard("{Escape}")
    await user.click(within(await rowFor("SAL-ORD-2026-0001")).getByRole("checkbox"))
    expect(screen.getByText("2 sales orders selected")).toBeInTheDocument()
    await openActions()
    expect(await screen.findByRole("menuitem", { name: "Cancel" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Close" })).toBeInTheDocument()
  })

  it("submits a draft through bulk_update and refreshes the row status", async () => {
    renderPage()

    await selectRows(["SAL-ORD-2026-0005"])
    await openActions()
    await user.click(await screen.findByRole("menuitem", { name: "Submit" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Submit 1 sales orders")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path.endsWith("bulk_update.bulk_update.submit_cancel_or_update_docs") && r.method === "POST"
      )
      expect(req).toBeDefined()
      const body = req?.body as Record<string, unknown>
      expect(body.doctype).toBe("Sales Order")
      expect(body.action).toBe("submit")
      expect(body.docnames).toBe(JSON.stringify(["SAL-ORD-2026-0005"]))
    })

    const refreshed = await rowFor("SAL-ORD-2026-0005")
    // After submit the row is submitted, under-delivered, and past its delivery
    // date — the Status column derives "Overdue" from the indicator tuple.
    await within(refreshed).findByText("Overdue")
    expect(within(refreshed).queryByText("Draft")).not.toBeInTheDocument()
  })

  it("closes a submitted order via close_or_unclose_sales_orders", async () => {
    renderPage()

    await selectRows(["SAL-ORD-2026-0001"])
    await openActions()
    await user.click(await screen.findByRole("menuitem", { name: "Close" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Close 1 sales orders")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Close" }))

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path.endsWith("sales_order.close_or_unclose_sales_orders") && r.method === "POST"
      )
      expect(req).toBeDefined()
      const body = req?.body as Record<string, unknown>
      expect(body.names).toBe(JSON.stringify(["SAL-ORD-2026-0001"]))
      expect(body.status).toBe("Closed")
    })

    const refreshed = await rowFor("SAL-ORD-2026-0001")
    await within(refreshed).findByText("Closed")
  })

  it("deletes a cancelled order through reportview.delete_items", async () => {
    renderPage()

    await selectRows(["SAL-ORD-2026-0006"])
    await openActions()
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Delete 1 sales orders")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      const req = lastRequest((r) => r.path.endsWith("reportview.delete_items") && r.method === "POST")
      expect(req).toBeDefined()
      const body = req?.body as Record<string, unknown>
      expect(body.doctype).toBe("Sales Order")
      expect(body.items).toBe(JSON.stringify(["SAL-ORD-2026-0006"]))
    })

    await waitFor(() => {
      expect(screen.queryByText("SAL-ORD-2026-0006")).not.toBeInTheDocument()
    })
  })

  it("exports the selection through the server-side download_template", async () => {
    renderPage()

    await selectRows(["SAL-ORD-2026-0001"])
    await openActions()
    await user.click(await screen.findByRole("menuitem", { name: "Export" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Export Sales Orders")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Export" }))

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path.endsWith("data_import.data_import.download_template") && r.method === "POST"
      )
      expect(req).toBeDefined()
      const body = req?.body as Record<string, unknown>
      expect(body.doctype).toBe("Sales Order")
      expect(body.file_type).toBe("CSV")
      expect(body.export_records).toBe("by_filter")
      expect(JSON.parse(String(body.export_fields))["Sales Order"]).toContain("customer_name")
    })
  })

  it("opens the print dialog with formats and previews the multi-PDF URL", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)

    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    await selectRows(["SAL-ORD-2026-0001"])
    await openActions()
    await user.click(await screen.findByRole("menuitem", { name: "Print" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Print Sales Orders")).toBeInTheDocument()

    const print = within(dialog).getByRole("button", { name: "Print" })
    await user.click(print)

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(1)
    })
    const opened = openSpy.mock.calls[0][0] as string
    expect(opened).toContain("/method/frappe.utils.print_format.download_multi_pdf")
    expect(opened).toContain("doctype=Sales+Order")
    expect(opened).toContain(`name=${encodeURIComponent(JSON.stringify(["SAL-ORD-2026-0001"]))}`)
    expect(opened).toContain("no_letterhead=1")
    expect(
      lastRequest((r) => r.path === "/api/resource/Print Format" && r.method === "GET")
    ).toBeDefined()
  })

  it("Load More appends the next page without hiding already-loaded rows", async () => {
    // Seed enough orders to overflow the default page length of 20. Older
    // transaction dates sort after the 6 fixture rows, so SL-...-0123 is the
    // last row returned and is only reachable via Load More.
    for (let i = 0; i < 24; i++) {
      salesOrders.push({
        name: `SAL-ORD-2026-0${String(100 + i).padStart(2, "0")}`,
        customer: "CUST-EXTRAS",
        customer_name: "Bulk Customer",
        transaction_date: `2026-06-${String(Math.max(1, 30 - i)).padStart(2, "0")}`,
        delivery_date: "2026-07-01",
        grand_total: 100 + i,
        status: "Draft",
        docstatus: 0,
        per_delivered: 0,
        per_billed: 0,
        owner: "admin@blesserp.com",
        creation: "2026-06-01T10:00:00",
        modified: "2026-06-01T10:00:00",
        modified_by: "admin@blesserp.com",
      })
    }

    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    // First page: 20 rows loaded, remainder still pending. The "20 of 30"
    // counter is split across nested spans, so match on textContent.
    expect(screen.getByText("SAL-ORD-2026-0001")).toBeInTheDocument()
    expect(screen.queryByText("SAL-ORD-2026-0115")).not.toBeInTheDocument()
    expect(screen.getByText(byCounter("20 of 30"))).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Load More" }))

    // Appended: total now loaded, the previous first row stayed visible and
    // the brand-new tail row appeared â€” nothing was hidden or replaced.
    await waitFor(() => {
      screen.getByText(byCounter("30 of 30"))
    })
    expect(screen.getByText("SAL-ORD-2026-0001")).toBeInTheDocument()
    expect(screen.getByText("SAL-ORD-2026-0123")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load More" })).not.toBeInTheDocument()

    const secondFetch = lastRequest(
      (r) =>
        r.path === "/api/resource/Sales Order" &&
        r.method === "GET" &&
        r.query.limit_page_length !== "0"
    )
    expect(secondFetch?.query.limit_start).toBe("20")
    expect(secondFetch?.query.limit_page_length).toBe("20")
  })

  it("changes the page size and reloads the full window of orders", async () => {
    for (let i = 0; i < 24; i++) {
      salesOrders.push({
        name: `SAL-ORD-2026-0${String(100 + i).padStart(2, "0")}`,
        customer: "CUST-EXTRAS",
        customer_name: "Bulk Customer",
        transaction_date: `2026-06-${String(Math.max(1, 30 - i)).padStart(2, "0")}`,
        delivery_date: "2026-07-01",
        grand_total: 100 + i,
        status: "Draft",
        docstatus: 0,
        per_delivered: 0,
        per_billed: 0,
        owner: "admin@blesserp.com",
        creation: "2026-06-01T10:00:00",
        modified: "2026-06-01T10:00:00",
        modified_by: "admin@blesserp.com",
      })
    }

    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")
    expect(screen.getByText(byCounter("20 of 30"))).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "100" }))

    await waitFor(() => {
      screen.getByText(byCounter("30 of 30"))
    })
    expect(screen.getByText("SAL-ORD-2026-0123")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load More" })).not.toBeInTheDocument()

    const lastFetch = lastRequest(
      (r) =>
        r.path === "/api/resource/Sales Order" &&
        r.method === "GET" &&
        r.query.limit_page_length !== "0"
    )
    expect(lastFetch?.query.limit_page_length).toBe("100")
  })
})

describe("SalesOrders list filters (ERPNext parity)", () => {
  it("filters by ID in the always-visible inline bar (like)", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    await user.type(screen.getByLabelText("ID"), "SAL-ORD-2026-0005")

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.filters ?? "")).toContain('["Sales Order","name","like","%SAL-ORD-2026-0005%"]')
    })
    await waitFor(() => {
      expect(screen.queryByText("SAL-ORD-2026-0001")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SAL-ORD-2026-0005")).toBeInTheDocument()

    await user.clear(screen.getByLabelText("ID"))
    await waitFor(() => {
      expect(screen.getByText("SAL-ORD-2026-0001")).toBeInTheDocument()
    })
  })

  it("filters by Customer Name in the inline bar (like)", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    await user.type(screen.getByLabelText("Customer Name"), "maple")

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.filters ?? "")).toContain('["Sales Order","customer_name","like","%maple%"]')
    })
    await waitFor(() => {
      expect(screen.queryByText("SAL-ORD-2026-0002")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SAL-ORD-2026-0001")).toBeInTheDocument()
  })

  it("filters by Delivery Status and Billing Status selects", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    await user.click(screen.getByRole("button", { name: "Delivery Status" }))
    await user.click(await screen.findByRole("button", { name: "Fully Delivered" }))
    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.filters ?? "")).toContain('["Sales Order","delivery_status","=","Fully Delivered"]')
    })
    // The dropdown trigger text reflects the chosen value.
    expect(screen.getByRole("button", { name: "Delivery Status" })).toHaveTextContent("Fully Delivered")
    await waitFor(() => {
      expect(screen.queryByText("SAL-ORD-2026-0001")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SAL-ORD-2026-0004")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Billing Status" }))
    await user.click(await screen.findByRole("button", { name: "Fully Billed" }))
    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      const f = String(req?.query?.filters ?? "")
      expect(f).toContain('["Sales Order","delivery_status","=","Fully Delivered"]')
      expect(f).toContain('["Sales Order","billing_status","=","Fully Billed"]')
    })
    expect(screen.getByRole("button", { name: "Billing Status" })).toHaveTextContent("Fully Billed")
    expect(screen.getByText("SAL-ORD-2026-0004")).toBeInTheDocument()
  })

  it("filters by exact order date", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")
    await user.type(screen.getByLabelText("Date"), "2026-07-07")

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      const f = String(req?.query?.filters ?? "")
      expect(f).toContain('["Sales Order","transaction_date","=","2026-07-07"]')
    })
    await waitFor(() => {
      expect(screen.queryByText("SAL-ORD-2026-0001")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SAL-ORD-2026-0004")).toBeInTheDocument()
    expect(screen.queryByText("SAL-ORD-2026-0003")).not.toBeInTheDocument()
    expect(screen.queryByText("SAL-ORD-2026-0006")).not.toBeInTheDocument()
    expect(screen.queryByText("SAL-ORD-2026-0005")).not.toBeInTheDocument()
  })

  it("drives the status filter from the quick pills", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    // The "To Deliver and Bill" pill expands to the ERPNext indicator tuple
    // (per_delivered < 100 AND per_billed < 100 AND status != Closed).
    await user.click(screen.getByRole("button", { name: "To Deliver and Bill" }))
    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.filters ?? "")).toContain(
        '["Sales Order","per_delivered","<",100],["Sales Order","per_billed","<",100],["Sales Order","status","!=","Closed"]'
      )
    })

    await user.click(screen.getByRole("button", { name: "All" }))
    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.filters ?? "")).not.toContain('"status"')
    })
  })

  it("clicking an order number applies the ID filter without navigating", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    await user.click(screen.getByRole("button", { name: "Filter by ID SAL-ORD-2026-0004" }))

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.filters ?? "")).toContain('["Sales Order","name","=","SAL-ORD-2026-0004"]')
    })

    // The inline ID pill shows the applied value and only the matching row remains.
    await waitFor(() => {
      expect(screen.getByLabelText("ID")).toHaveValue("SAL-ORD-2026-0004")
      expect(screen.queryByText("SAL-ORD-2026-0001")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SAL-ORD-2026-0004")).toBeInTheDocument()

    // Clicking a list value never opens the detail workspace.
    expect(screen.queryByRole("button", { name: "Update Items" })).not.toBeInTheDocument()
  })

  it("clicking a status badge sets the status filter", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    await user.click(screen.getByRole("button", { name: "Filter by status Completed" }))

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.filters ?? "")).toContain('["Sales Order","status","=","Completed"]')
    })

    await waitFor(() => {
      expect(screen.queryByText("SAL-ORD-2026-0001")).not.toBeInTheDocument()
    })
    expect(within(await rowFor("SAL-ORD-2026-0004")).getByText("Completed")).toBeInTheDocument()
  })

  it("clicking an Overdue badge applies the ERPNext composite overdue filter", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    // Multiple rows share the Overdue badge — pick the first.
    await user.click(screen.getAllByRole("button", { name: "Filter by status Overdue" })[0])

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      const f = String(req?.query?.filters ?? "")
      expect(f).toContain('["Sales Order","per_delivered","<",100]')
      expect(f).toContain('["Sales Order","delivery_date","<","Today"]')
      expect(f).toContain('["Sales Order","status","!=","Closed"]')
      expect(f).toContain('["Sales Order","docstatus","=",1]')
    })

    // Only the three overdue submitted orders remain; draft/cancelled rows are
    // excluded by the docstatus=1 leg of the tuple.
    await waitFor(() => {
      expect(screen.queryByText("SAL-ORD-2026-0004")).not.toBeInTheDocument()
      expect(screen.queryByText("SAL-ORD-2026-0005")).not.toBeInTheDocument()
      expect(screen.queryByText("SAL-ORD-2026-0006")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SAL-ORD-2026-0001")).toBeInTheDocument()
    expect(screen.getByText("SAL-ORD-2026-0002")).toBeInTheDocument()
    expect(screen.getByText("SAL-ORD-2026-0003")).toBeInTheDocument()
  })

  it("clicking a delivery date sets the delivery_date filter in the Delivery Date pill", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    await user.click(screen.getByRole("button", { name: "Filter by delivery date 2026-07-15" }))

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.filters ?? "")).toContain('["Sales Order","delivery_date","=","2026-07-15"]')
    })

    await waitFor(() => {
      expect(screen.getByLabelText("Delivery Date")).toHaveValue("15-07-2026")
      expect(screen.queryByText("SAL-ORD-2026-0004")).not.toBeInTheDocument()
    })
    expect(screen.getByText("SAL-ORD-2026-0001")).toBeInTheDocument()
  })

  it("sorts by the selector field and toggles asc/desc", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    await user.selectOptions(screen.getByLabelText("Sort field"), "grand_total")
    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.order_by ?? "")).toContain("grand_total")
    })

    await user.click(screen.getByRole("button", { name: "Sort grand_total desc" }))
    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.order_by ?? "").toUpperCase()).toContain("GRAND_TOTAL ASC")
    })
  })

  it("restores filters and sort from the URL query string", async () => {
    const query =
      "?filters=" +
      encodeURIComponent(
        JSON.stringify([{ field: "name", label: "ID", operator: "like", value: "SAL-ORD-2026-0005" }])
      ) +
      "&sort=grand_total%20asc"
    renderPageWithQuery(query)
    await screen.findByText("SAL-ORD-2026-0005")

    expect(screen.getByLabelText("ID")).toHaveValue("SAL-ORD-2026-0005")

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.filters ?? "")).toContain('["Sales Order","name","like","%SAL-ORD-2026-0005%"]')
      expect(String(req?.query?.order_by ?? "").toUpperCase()).toContain("GRAND_TOTAL ASC")
    })
  })

  it("clears every filter from the inline bar with Clear all", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    await user.type(screen.getByLabelText("ID"), "maple")
    await user.click(screen.getByRole("button", { name: "Delivery Status" }))
    await user.click(await screen.findByRole("button", { name: "Fully Delivered" }))
    await user.click(screen.getByText("Clear all"))

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.filters ?? "")).toBe("")
    })
    expect(screen.getByLabelText("ID")).toHaveValue("")
    await waitFor(() => {
      expect(screen.getByText("SAL-ORD-2026-0001")).toBeInTheDocument()
    })
  })

  it("adds an advanced filter via the FilterGroup popover (grand_total >= 1000)", async () => {
    renderPage()
    await screen.findByText("SAL-ORD-2026-0001")

    await user.click(screen.getByRole("button", { name: "Advanced Filter" }))
    await user.click(await screen.findByRole("button", { name: /Add a Filter/ }))
    await user.selectOptions(await screen.findByLabelText("Filter field"), "grand_total")
    await user.selectOptions(screen.getByLabelText("Filter condition"), ">=")
    await user.type(screen.getByLabelText("Filter value"), "1000")
    await user.click(screen.getByRole("button", { name: /Apply/ }))

    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path === "/api/resource/Sales Order" && r.method === "GET" && r.query.limit_page_length !== "0"
      )
      expect(String(req?.query?.filters ?? "")).toContain('["Sales Order","grand_total",">=","1000"]')
    })
  })

  it("seeds the advanced filter popover from active URL filters", async () => {
    renderPageWithQuery(
      `?filters=${encodeURIComponent(
        JSON.stringify([{ field: "status", label: "Status", operator: "=", value: "Draft" }])
      )}`
    )
    await screen.findByText("SAL-ORD-2026-0005")

    await user.click(screen.getByRole("button", { name: "Advanced Filter" }))
    await waitFor(() => {
      expect(screen.getByLabelText("Filter field")).toHaveValue("status")
    })
    expect(screen.getByLabelText("Filter value")).toHaveValue("Draft")
  })
})

describe("SalesOrderWorkspace status dropdown (ERPNext parity)", () => {
  it("shows a Status dropdown with On Hold + Close for an active submitted order", async () => {
    renderWorkspace("SAL-ORD-2026-0001")

    // Active submitted order → Update Items button present.
    expect(await screen.findByRole("button", { name: "Update Items" })).toBeInTheDocument()

    // No Update (save) button until the form is actually dirty.
    expect(screen.queryByTestId("save_button")).not.toBeInTheDocument()

    // Regression: the company default-address trigger used to fire 2s after load
    // and silently dirty an untouched submitted doc, surfacing the Update button.
    await new Promise((resolve) => setTimeout(resolve, 2100))
    expect(screen.queryByTestId("save_button")).not.toBeInTheDocument()

    // Status control lives in the toolbar (button), right next to Update Items,
    // while the title row keeps the ERPNext form-header indicator — a derived
    // badge (here "Overdue", not the stored "To Deliver and Bill" literal).
    const updateItems = screen.getByRole("button", { name: "Update Items" })
    const trigger = screen.getByTitle("Change status")
    expect(trigger.parentElement).toBe(updateItems.parentElement)
    expect(trigger).toHaveTextContent("Status")
    const badge = screen.getByText("OVERDUE", { selector: "span" })
    expect(badge).toBeInTheDocument()

    await user.click(trigger)
    expect(await screen.findByRole("menuitem", { name: "On Hold" })).toBeInTheDocument()
    const closeItem = screen.getByRole("menuitem", { name: "Close" })
    expect(closeItem).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Resume" })).not.toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Re-open" })).not.toBeInTheDocument()

    // Close is a direct call (no reason dialog required).
    await user.click(closeItem)
    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path.endsWith("sales_order.update_status") && r.method === "POST"
      )
      expect(req?.body?.status).toBe("Closed")
    })
  })

  it("requires a reason, records it as a comment, then holds the order", async () => {
    renderWorkspace("SAL-ORD-2026-0001")
    await screen.findByRole("button", { name: "Update Items" })

    await user.click(screen.getByTitle("Change status"))
    await user.click(await screen.findByRole("menuitem", { name: "On Hold" }))

    expect(await screen.findByRole("heading", { name: "Reason for Hold" })).toBeInTheDocument()

    // Empty reason is rejected.
    await user.click(screen.getByRole("button", { name: "Hold" }))
    expect(await screen.findByText("Reason for hold is required.")).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Hold Reason/i), "Cashflow freeze")
    await user.click(screen.getByRole("button", { name: "Hold" }))

    await waitFor(() => {
      const commentReq = lastRequest((r) => r.path.endsWith("form.utils.add_comment"))
      expect(String(commentReq?.body?.content ?? "")).toContain("Reason for hold: Cashflow freeze")
    })
    await waitFor(() => {
      const statusReq = lastRequest(
        (r) => r.path.endsWith("sales_order.update_status") && r.method === "POST"
      )
      expect(statusReq?.body?.status).toBe("On Hold")
    })

    // After reload the dropdown shows Resume + Close (the static tool bar
    // button keeps its "Status" label; the title-row badge carries the state).
    await waitFor(() => {
      expect(screen.getByText("ON HOLD", { selector: "span" })).toBeInTheDocument()
    })
    await user.click(screen.getByTitle("Change status"))
    expect(await screen.findByRole("menuitem", { name: "Resume" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Close" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "On Hold" })).not.toBeInTheDocument()
  })

  it("hides status actions and Update Items for a fully delivered + billed order", async () => {
    renderWorkspace("SAL-ORD-2026-0004")
    await screen.findByText("SAL-ORD-2026-0004")

    expect(screen.queryByRole("button", { name: "Update Items" })).not.toBeInTheDocument()
    expect(screen.queryByTitle("Change status")).not.toBeInTheDocument()
    expect(screen.getByText("COMPLETED")).toBeInTheDocument()
  })

  it("persists Update Items qty edits into the main items grid", async () => {
    renderWorkspace("SAL-ORD-2026-0001")
    await screen.findByRole("button", { name: "Update Items" })

    await user.click(screen.getByRole("button", { name: "Update Items" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("PRD-001")).toBeInTheDocument()

    // Activate the first row (ERPNext-style one-row-at-a-time editing) and change qty.
    await user.click(within(dialog).getByText("40"))
    const [qtyInput] = within(dialog).getAllByRole("spinbutton")
    await user.clear(qtyInput)
    await user.type(qtyInput, "41")

    await user.click(within(dialog).getByRole("button", { name: "Update" }))

    // update_child_qty_rate was POSTed with the new qty for the EXISTING child
    // row (ERPNext v15: rows carrying a docname are edited in place).
    await waitFor(() => {
      const req = lastRequest(
        (r) => r.path.endsWith("accounts_controller.update_child_qty_rate") && r.method === "POST"
      )
      expect(req).toBeTruthy()
      const trans = JSON.parse(String(req?.body?.trans_items ?? "[]")) as Array<Record<string, unknown>>
      expect(trans[0]).toMatchObject({ item_code: "PRD-001", qty: 41, docname: "PRD-001" })
    })

    // Dialog closes and the workspace reloads the doc — the main grid's first
    // row now shows the updated qty.
    await waitFor(() => {
      expect(within(dialog).queryByRole("button", { name: "Update" })).not.toBeInTheDocument()
    })
    await waitFor(() => {
      const cell = document.querySelector('[data-testid="sales-order-items_0_qty"]')
      expect(cell).toHaveTextContent("41")
    })
  })

  it("surfaces an ERPNext update_child_qty_rate validation error instead of silently closing", async () => {
    // Frappe reports many validations as HTTP 200 + _server_messages/exc_type.
    // The update service must surface them so the dialog shows the reason and
    // stays open instead of silently reloading an unchanged doc.
    server.use(
      http.post(
        "*/api/method/erpnext.controllers.accounts_controller.update_child_qty_rate",
        () =>
          HttpResponse.json({
            exc_type: "ValidationError",
            exc: "ValidationError: Cannot set quantity less than delivered quantity.",
            _server_messages:
              '[{"message":"Cannot set quantity less than delivered quantity.","indicator":"red","raise_exception":1}]',
          }),
      ),
    )
    renderWorkspace("SAL-ORD-2026-0001")
    await screen.findByRole("button", { name: "Update Items" })

    try {
      await user.click(screen.getByRole("button", { name: "Update Items" }))
      const dialog = await screen.findByRole("dialog")
      await user.click(within(dialog).getByText("40"))
      const [qtyInput] = within(dialog).getAllByRole("spinbutton")
      await user.clear(qtyInput)
      await user.type(qtyInput, "999")
      await user.click(within(dialog).getByRole("button", { name: "Update" }))

      await waitFor(() => {
        expect(
          within(dialog).getByText("Cannot set quantity less than delivered quantity.")
        ).toBeInTheDocument()
      })
      expect(within(dialog).getByRole("button", { name: "Update" })).toBeInTheDocument()
    } finally {
      server.resetHandlers()
    }
  })

  it("stays clean until edited and clears dirty after saving (draft)", async () => {
    renderWorkspace("SAL-ORD-2026-0005")
    await screen.findByTestId("submit_button")

    // A freshly loaded untouched draft shows Submit, never a Save/Update button.
    expect(screen.queryByTestId("save_button")).not.toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 2100))
    expect(screen.queryByTestId("save_button")).not.toBeInTheDocument()

    // Activate the first item row (ERPNext-style editing) and bump qty → dirty.
    await user.click(screen.getByText("40"))
    const qtyCell = document.querySelector('[data-testid="sales-order-items_0_qty"]')
    const qtyInput = within(qtyCell as HTMLElement).getByRole("spinbutton")
    await user.clear(qtyInput)
    await user.type(qtyInput, "41")
    await waitFor(() => expect(screen.getByTestId("save_button")).toBeInTheDocument())

    // Saving an existing draft resets the baseline → the Save button disappears.
    await user.click(screen.getByTestId("save_button"))
    await waitFor(() => expect(screen.queryByTestId("save_button")).not.toBeInTheDocument())
    expect(screen.getByTestId("submit_button")).toBeInTheDocument()
  })

  it("never re-submits a submitted order via savedocs (non-item edit → locked message)", async () => {
    renderWorkspace("SAL-ORD-2026-0001")
    await screen.findByRole("button", { name: "Update Items" })
    expect(screen.queryByTestId("save_button")).not.toBeInTheDocument()

    // po_no is an editable allow_on_submit header — editing it dirties the form
    // and surfaces the Update button. Regression: the old code re-sent the whole
    // submitted doc through frappe.desk.form.save.savedocs, which re-submits the
    // order server-side and trips a child-doctype permission 403.
    await user.type(screen.getByPlaceholderText("PO number…"), "PO-999")
    await waitFor(() => expect(screen.getByTestId("save_button")).toBeInTheDocument())

    const before = capturedRequests.length
    await user.click(screen.getByTestId("save_button"))

    expect(await screen.findByText(/locked after submission/i)).toBeInTheDocument()
    expect(screen.getByText(/po_no/)).toBeInTheDocument()

    const duringSave = capturedRequests.slice(before)
    expect(duringSave.some((r) => r.path === "/api/method/frappe.desk.form.save.savedocs")).toBe(false)
  })

  it("resolves the selling price when an item is added through Update Items", async () => {
    renderWorkspace("SAL-ORD-2026-0001")
    await screen.findByRole("button", { name: "Update Items" })

    await user.click(screen.getByRole("button", { name: "Update Items" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("PRD-001")).toBeInTheDocument()

    // Rewrite the first row's item to PRD-003 (Wild Blueberry Jam, $15 in
    // Standard Selling). Regression: the enrich envelope used to price newly
    // selected items at 0 on the real bench.
    await user.click(within(dialog).getByText("PRD-001"))
    const itemInput = within(dialog).getByPlaceholderText("Search item…")
    await user.clear(itemInput)
    await user.type(itemInput, "PRD-003")

    const option = await screen.findByRole("button", { name: /PRD-003/ })
    await user.click(option)

    await waitFor(() => {
      const [qtyInput, rateInput] = within(dialog).getAllByRole("spinbutton")
      expect(qtyInput).toHaveValue(40)
      expect(rateInput).toHaveValue(15)
    })

    const detailsReq = lastRequest(
      (r) => r.path.endsWith("get_item_details.get_item_details") && r.method === "POST"
    )
    const args = (() => {
      try {
        return JSON.parse(String((detailsReq?.body as Record<string, unknown>)?.args ?? "{}"))
      } catch {
        return {}
      }
    })() as Record<string, unknown>
    expect(args.item_code).toBe("PRD-003")
    expect(args.price_list).toBe("Standard Selling")
  })

  it("shows a not-available message when the Create menu's Pick List action is clicked", async () => {
    renderWorkspace("SAL-ORD-2026-0001")
    await screen.findByRole("button", { name: "Create" })

    await user.click(screen.getByRole("button", { name: "Create" }))
    await user.click(await screen.findByRole("button", { name: "Pick List" }))

    expect(await screen.findByText("Pick List module is not available yet.")).toBeInTheDocument()
    // Not a real Pick List flow: no mapper call is issued for the action.
    expect(
      capturedRequests.some((r) => r.path.endsWith("make_mapped_doc") && r.method === "POST")
    ).toBe(false)
  })
})