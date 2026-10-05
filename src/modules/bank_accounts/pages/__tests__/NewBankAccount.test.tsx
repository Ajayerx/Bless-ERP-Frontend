import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import NewBankAccount from "../NewBankAccount"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { server, resetFixtures, lastRequest } from "@/mocks/server"

vi.mock("@/components/layout/Topbar", () => ({ default: () => null }))

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => resetFixtures())
afterAll(() => server.close())
afterEach(() => {
  resetFixtures()
  vi.restoreAllMocks()
})

const user = userEvent.setup()

function renderPage(entry = "/bank-accounts/new") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ToastProvider>
        <MessageDialogProvider>
          <Routes>
            <Route path="/bank-accounts/new" element={<NewBankAccount />} />
            <Route path="/bank-accounts/:id" element={<div>ACCOUNT_DETAIL_PAGE</div>} />
          </Routes>
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

async function pickLink(placeholder: string, option: string) {
  await user.click(screen.getByPlaceholderText(placeholder))
  await user.type(screen.getByPlaceholderText(placeholder), option.slice(0, 3))
  await user.click(await screen.findByRole("button", { name: new RegExp(option) }))
}

describe("NewBankAccount form (M3.5)", () => {
  it("renders the ERPNext fields and requires account name + bank", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "New Bank Account" })).toBeInTheDocument()
    expect(screen.getByLabelText("Account Name *")).toBeInTheDocument()
    expect(screen.getByLabelText("Bank *")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Save Account/ })).toBeInTheDocument()

    // Company account section on by default.
    expect(screen.getByLabelText("Company *")).toBeInTheDocument()
    expect(screen.getByLabelText("Company Account *")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Save Account/ }))
    expect(await screen.findByText("Account name is required.")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Account Name *"), "Ops Chequing")
    await user.click(screen.getByRole("button", { name: /Save Account/ }))
    await waitFor(() =>
      expect(screen.queryByText("Account name is required.")).not.toBeInTheDocument()
    )
    expect(await screen.findByText("Bank is required.")).toBeInTheDocument()
  })

  it("creates a company bank account with bank, company and GL account", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Bank Account" })

    await user.type(screen.getByLabelText("Account Name *"), "Ops Chequing")
    await pickLink("Select bank…", "Royal Bank of Canada")
    await pickLink("Select company…", "Bless Erp")
    await pickLink("Select Bank-type account…", "Cheque - BE")

    await user.click(screen.getByRole("button", { name: /Save Account/ }))

    const created = await waitFor(() => {
      const req = lastRequest((r) => r.method === "POST" && r.path === "/api/resource/Bank Account")
      expect(req).toBeDefined()
      return req
    })
    const body = created?.body as Record<string, unknown>
    expect(body.account_name).toBe("Ops Chequing")
    expect(body.bank).toBe("Royal Bank of Canada")
    expect(body.company).toBe("Bless Erp")
    expect(body.account).toBe("Cheque - BE")
    expect(body.is_company_account).toBe(1)

    expect(await screen.findByText("ACCOUNT_DETAIL_PAGE")).toBeInTheDocument()
  })

  it("toggling off company account shows the party section and requires party", async () => {
    renderPage()
    await screen.findByRole("heading", { name: "New Bank Account" })

    const switches = screen.getAllByRole("switch")
    await user.click(switches[0])

    expect(screen.queryByLabelText("Company *")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Party Type")).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText("Party Type"), "Customer")
    await user.type(screen.getByLabelText("Account Name *"), "AlphaCorp Collections")
    await pickLink("Select bank…", "Royal Bank of Canada")
    await user.click(screen.getByRole("button", { name: /Save Account/ }))
    expect(await screen.findByText(/Party is required/)).toBeInTheDocument()
  })

  it("prefills party_type and party from query params and creates a party account", async () => {
    renderPage("/bank-accounts/new?party_type=Customer&party=AlphaCorp")
    await screen.findByRole("heading", { name: "New Bank Account" })

    expect(screen.getByDisplayValue("Customer")).toBeInTheDocument()
    expect(screen.getByDisplayValue("AlphaCorp")).toBeInTheDocument()
    // Party accounts default the company section off.
    expect(screen.queryByLabelText("Company *")).not.toBeInTheDocument()

    await user.type(screen.getByLabelText("Account Name *"), "AlphaCorp Collections")
    await pickLink("Select bank…", "Royal Bank of Canada")
    await user.click(screen.getByRole("button", { name: /Save Account/ }))

    const created = await waitFor(() => {
      const req = lastRequest((r) => r.method === "POST" && r.path === "/api/resource/Bank Account")
      expect(req).toBeDefined()
      return req
    })
    const body = created?.body as Record<string, unknown>
    expect(body.is_company_account).toBe(0)
    expect(body.party_type).toBe("Customer")
    expect(body.party).toBe("AlphaCorp")

    expect(await screen.findByText("ACCOUNT_DETAIL_PAGE")).toBeInTheDocument()
  })
})