import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest"

import JournalEntries from "../JournalEntries"
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
    <MemoryRouter initialEntries={["/journal-entries"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <JournalEntries />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function listReq() {
  return lastRequest((r) => r.method === "GET" && r.path === "/api/resource/Journal Entry")
}

// The fixture sets JE title = name, so a name can appear in both the Number and
// Title columns — always resolve via findAllByText.
async function rowFor(name: string): Promise<HTMLElement> {
  const cells = await screen.findAllByText(name)
  return cells[0].closest("tr") as HTMLElement
}

async function seeRow(name: string): Promise<void> {
  await screen.findAllByText(name)
}

const absent = (name: string) =>
  waitFor(() => {
    expect(screen.queryAllByText(name).length).toBe(0)
  })

describe("Journal Entries list page (M3.6 parity)", () => {
  it("renders all journal entries with badges and totals", async () => {
    renderPage()

    await seeRow("ACC-JV-2026-00001")
    expect(within(await rowFor("ACC-JV-2026-00001")).getByText("Submitted")).toBeInTheDocument()
    expect(within(await rowFor("ACC-JV-2026-00001")).getByText("Journal Entry")).toBeInTheDocument()
    expect(within(await rowFor("ACC-JV-2026-00002")).getByText("Draft")).toBeInTheDocument()
    expect(within(await rowFor("ACC-JV-2026-00005")).getByText("Cancelled")).toBeInTheDocument()
    expect(within(await rowFor("ACC-JV-2026-00001")).getAllByText("$2,500.00").length).toBe(2)

    expect(screen.getByText("5 journal entries")).toBeInTheDocument()
  })

  it("filters by the Submitted pill (docstatus = 1)", async () => {
    renderPage()
    await seeRow("ACC-JV-2026-00001")

    await user.click(screen.getByRole("button", { name: "Submitted" }))

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain('["Journal Entry","docstatus","=",1]')
    })
    await seeRow("ACC-JV-2026-00003")
    await absent("ACC-JV-2026-00002")
    expect(screen.getByText("2 journal entries")).toBeInTheDocument()
  })

  it("searches with the OR group", async () => {
    renderPage()
    await seeRow("ACC-JV-2026-00001")

    await user.type(screen.getByPlaceholderText("Search journal entries..."), "fuel")

    await waitFor(() => {
      expect(String(listReq()?.query?.filters ?? "")).toContain('%fuel%')
    })
    await seeRow("ACC-JV-2026-00005")
    await absent("ACC-JV-2026-00001")
    expect(screen.getByText("1 journal entries")).toBeInTheDocument()
  })
})