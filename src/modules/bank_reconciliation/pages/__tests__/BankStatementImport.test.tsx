import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest"

import BankStatementImport from "../BankStatementImport"
import { ToastProvider, MessageDialogProvider } from "@/components/ui"
import { server, resetFixtures, bankReconState } from "@/mocks/server"

vi.mock("@/components/layout/Topbar", () => ({ default: () => null }))

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
beforeEach(() => resetFixtures())
afterAll(() => server.close())
afterEach(() => {
  resetFixtures()
  vi.restoreAllMocks()
})

const user = userEvent.setup()

const CSV = [
  "Date,Description,Deposit,Withdrawal,Reference Number",
  "2026-10-01,Imported deposit,5000,,IMP-001",
  "2026-10-02,Imported bank fee,,45,IMP-002",
].join("\n")

function csvFile() {
  return new File([CSV], "statement.csv", { type: "text/csv" })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/bank-reconciliation/import"]}>
      <ToastProvider>
        <MessageDialogProvider>
          <BankStatementImport />
        </MessageDialogProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

async function selectBankAccount(name = "Cheque - BE") {
  const input = screen.getByPlaceholderText("Select Bank Account")
  await user.click(input)
  await user.type(input, name)
  const option = await screen.findByRole("button", { name: new RegExp(name, "i") })
  await user.click(option)
}

describe("Bank Statement Import wizard", () => {
  it("requires a Bank Account before reading the statement", async () => {
    renderPage()

    await user.upload(screen.getByLabelText("CSV File"), csvFile())

    expect(await screen.findByText("Bank Account is required")).toBeInTheDocument()
  })

  it("parses the CSV, prefills the column mapping and previews rows", async () => {
    renderPage()
    await selectBankAccount()

    await user.upload(screen.getByLabelText("CSV File"), csvFile())

    expect(await screen.findByText("Imported deposit")).toBeInTheDocument()
    expect(screen.getByText("IMP-001")).toBeInTheDocument()
    // Default mapping from get_bank_mapping.
    expect(screen.getByLabelText("Date")).toHaveValue("date")
    expect(screen.getByLabelText("Description")).toHaveValue("description")
    expect(screen.getByLabelText("Deposit")).toHaveValue("deposit")
  })

  it("imports the mapped rows as Bank Transactions", async () => {
    renderPage()
    await selectBankAccount()

    await user.upload(screen.getByLabelText("CSV File"), csvFile())
    await screen.findByText("Imported deposit")

    await user.click(screen.getByRole("button", { name: /Import Transactions/i }))

    await waitFor(() =>
      expect(
        bankReconState.transactions.some((t) => t.description === "Imported deposit")
      ).toBe(true)
    )
    const imported = bankReconState.transactions.find((t) => t.description === "Imported deposit")
    expect(imported?.deposit).toBe(5000)
    expect(imported?.bank_account).toBe("Cheque - BE")
    expect(imported?.docstatus).toBe(1)
  })
})
