import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { http, HttpResponse } from "msw"

import GetItemsFromModal from "../GetItemsFromModal"
import { server, resetFixtures, capturedRequests } from "@/mocks/server"

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
beforeEach(() => {
  resetFixtures()
})
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  resetFixtures()
  vi.restoreAllMocks()
})

const user = userEvent.setup()

function renderModal(onItemsFetched: (items: Array<Record<string, unknown>>) => void) {
  return render(
    <MemoryRouter>
      <GetItemsFromModal
        open
        onOpenChange={() => {}}
        sourceDoctype="Quotation"
        method="erpnext.selling.doctype.quotation.quotation.make_sales_order"
        title="Select Quotation"
        childFieldname="items"
        childDoctype="Quotation Item"
        childColumns={["item_code", "item_name", "qty", "rate", "amount"]}
        setters={[{ fieldname: "party_name", label: "Customer" }]}
        company="BlessERP Inc."
        onItemsFetched={onItemsFetched}
      />
    </MemoryRouter>,
  )
}

describe("GetItemsFromModal (Sales Order, Quotation source)", () => {
  it("lists quotations and maps the selected one's items into the SO", async () => {
    const onItemsFetched = vi.fn()
    renderModal(onItemsFetched)

    await waitFor(() => {
      expect(screen.getByText("SAL-QTN-2026-0001")).toBeInTheDocument()
    })

    const row = screen.getByText("SAL-QTN-2026-0001").closest("label")
    expect(row).not.toBeNull()
    await user.click(within(row as HTMLElement).getByRole("checkbox"))

    await user.click(screen.getByRole("button", { name: "Get Items" }))

    await waitFor(() => expect(onItemsFetched).toHaveBeenCalledTimes(1))
    const items = onItemsFetched.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThan(0)
    expect(items.some((i) => i.item_code === "PRD-001")).toBe(true)

    const mapDocs = capturedRequests.find((r) => r.path.includes("frappe.model.mapper.map_docs"))
    expect(mapDocs).toBeDefined()
    const targetDoc = String((mapDocs!.body as Record<string, unknown>).target_doc ?? "")
    expect(targetDoc).toContain('"doctype":"Sales Order"')
    expect(targetDoc).not.toContain('"items"')
  })

  it("keeps the modal open with an error when the backend returns no items", async () => {
    server.use(
      http.post("/api/method/frappe.model.mapper.map_docs", () =>
        HttpResponse.json({ message: { doctype: "Sales Order", items: [] } }),
      ),
    )
    const onItemsFetched = vi.fn()
    renderModal(onItemsFetched)

    await waitFor(() => {
      expect(screen.getByText("SAL-QTN-2026-0001")).toBeInTheDocument()
    })

    const row = screen.getByText("SAL-QTN-2026-0001").closest("label")
    await user.click(within(row as HTMLElement).getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "Get Items" }))

    await waitFor(() => {
      expect(screen.getByText(/No items were returned from the selected Quotation/i)).toBeInTheDocument()
    })
    expect(onItemsFetched).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /Get Items/ })).toBeInTheDocument()
  })
})