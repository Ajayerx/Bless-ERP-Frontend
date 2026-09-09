import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import SalesOrders from "../SalesOrders"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { server, resetFixtures, lastRequest } from "@/mocks/server"
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

    // Raw status literals surface as badges (not the simplified mapped status).
    await screen.findByText("SAL-ORD-2026-0001")
    expect(screen.getAllByText("To Deliver and Bill").length).toBeGreaterThanOrEqual(4)
    expect(within(await rowFor("SAL-ORD-2026-0004")).getByText("Completed")).toBeInTheDocument()
    // Cancelled row shows the raw status badge.
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
    await within(refreshed).findByText("To Deliver and Bill")
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

    const preview = within(dialog).getByRole("button", { name: "Preview" })
    await user.click(preview)

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