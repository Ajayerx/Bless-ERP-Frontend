import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import EmailTemplates from "../pages/EmailTemplates"
import { emailTemplateService } from "../services"

// Topbar pulls in Auth/Theme/Router contexts that are irrelevant to the
// management page itself.
vi.mock("@/components/layout/Topbar", () => ({ default: () => <div /> }))

vi.mock("@/components/ui/message-dialog", () => ({
  MessageDialogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useMessageDialog: () => ({ showMessage: vi.fn() }),
  messageFromError: (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : fallback,
}))

vi.mock("../services", () => ({
  emailTemplateService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    names: vi.fn(),
    render: vi.fn(),
  },
}))

const template = (overrides: Record<string, unknown> = {}) => ({
  name: "Invoice Reminder",
  template_name: "Invoice Reminder",
  subject: "Invoice {{doc.name}} due on {{doc.due_date}}",
  response: "<p>Dear {{doc.customer_name}}</p>",
  use_html: 1,
  enabled: 1,
  ...overrides,
})

function listResponse(items: Array<ReturnType<typeof template>>) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 0,
    totalPages: 1,
  }
}

async function renderPage() {
  await act(async () => {
    render(
      <MemoryRouter>
        <EmailTemplates />
      </MemoryRouter>,
    )
  })
  await waitFor(() => expect(emailTemplateService.list).toHaveBeenCalled())
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(emailTemplateService.list).mockResolvedValue(
    listResponse([template()] as never),
  )
  vi.mocked(emailTemplateService.names).mockResolvedValue([])
})

describe("EmailTemplates management page", () => {
  it("lists templates with their subject, HTML flag and status", async () => {
    vi.mocked(emailTemplateService.list).mockResolvedValue(
      listResponse([
        template(),
        template({
          name: "Quotation Follow Up",
          template_name: "Quotation Follow Up",
          use_html: 0,
          enabled: 0,
          subject: "",
        }),
      ]) as never,
    )
    await renderPage()

    // Each row shows the template name and its docname underneath.
    expect(await screen.findAllByText("Invoice Reminder")).toHaveLength(2)
    expect(screen.getAllByText("Quotation Follow Up")).toHaveLength(2)
    expect(screen.getByText(/Invoice \{\{doc\.name\}\} due on/)).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
    // Rows: one HTML + enabled, one plain + disabled. ("Enabled"/"Disabled" also
    // name the status tabs, hence the multi-match assertions.)
    expect(screen.getAllByText("Enabled").length).toBeGreaterThan(1)
    expect(screen.getAllByText("Disabled").length).toBeGreaterThan(1)
  })

  it("passes the search text and status tab through to the service", async () => {
    await renderPage()

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/search email templates/i), {
        target: { value: "invoice" },
      })
    })
    await waitFor(() => {
      expect(emailTemplateService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "invoice" }),
      )
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Disabled" }))
    })
    await waitFor(() => {
      expect(emailTemplateService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "disabled" }),
      )
    })
  })

  it("creates a template through the modal and refreshes the list", async () => {
    vi.mocked(emailTemplateService.create).mockResolvedValue(
      template({ name: "Payment Request" }) as never,
    )
    await renderPage()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /new email template/i }))
    })
    await screen.findByLabelText(/template name/i)

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/template name/i), {
        target: { value: "Payment Request" },
      })
      fireEvent.change(screen.getByLabelText(/subject/i), {
        target: { value: "Payment for {{doc.name}}" },
      })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^create$/i }))
    })

    await waitFor(() => {
      expect(emailTemplateService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          template_name: "Payment Request",
          subject: "Payment for {{doc.name}}",
        }),
      )
    })
    await waitFor(() => expect(emailTemplateService.list).toHaveBeenCalledTimes(2))
  })

  it("refuses to save a template with no name", async () => {
    await renderPage()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /new email template/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^create$/i }))
    })

    expect(await screen.findByText(/template name is required/i)).toBeInTheDocument()
    expect(emailTemplateService.create).not.toHaveBeenCalled()
  })

  it("edits an existing template and sends the name in the PUT", async () => {
    vi.mocked(emailTemplateService.getById).mockResolvedValue(template() as never)
    vi.mocked(emailTemplateService.update).mockResolvedValue(template() as never)
    await renderPage()

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: /edit/i }))
    })
    // The list omits `response`, so the full record is fetched first.
    await waitFor(() =>
      expect(emailTemplateService.getById).toHaveBeenCalledWith("Invoice Reminder"),
    )

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/subject/i), {
        target: { value: "Updated subject" },
      })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }))
    })

    await waitFor(() => {
      expect(emailTemplateService.update).toHaveBeenCalledWith(
        "Invoice Reminder",
        expect.objectContaining({ subject: "Updated subject" }),
      )
    })
  })

  it("keeps the existing body when the full record is loaded", async () => {
    // ERPNext stores the HTML body in `response`; `response_html` is absent.
    const full = template({ response_html: undefined }) as never as {
      response: string
      response_html?: string
    }
    vi.mocked(emailTemplateService.getById).mockResolvedValue(full)
    vi.mocked(emailTemplateService.update).mockResolvedValue(full)
    await renderPage()

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: /edit/i }))
    })
    await waitFor(() => expect(emailTemplateService.getById).toHaveBeenCalled())
    expect(screen.getByLabelText(/message/i)).toHaveValue("<p>Dear {{doc.customer_name}}</p>")

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }))
    })
    await waitFor(() => {
      expect(emailTemplateService.update).toHaveBeenCalledWith(
        "Invoice Reminder",
        expect.objectContaining({ response: "<p>Dear {{doc.customer_name}}</p>" }),
      )
    })
  })

  it("still opens the editor when the full-record lookup fails", async () => {
    vi.mocked(emailTemplateService.getById).mockRejectedValue(new Error("offline"))
    await renderPage()

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: /edit/i }))
    })
    await waitFor(() =>
      expect(screen.getByLabelText(/template name/i)).toHaveValue("Invoice Reminder"),
    )
  })

  it("toggles Use HTML and Enabled on an edited template", async () => {
    vi.mocked(emailTemplateService.getById).mockResolvedValue(template() as never)
    vi.mocked(emailTemplateService.update).mockResolvedValue(template() as never)
    await renderPage()

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: /edit/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: /enabled/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }))
    })

    await waitFor(() => {
      expect(emailTemplateService.update).toHaveBeenCalledWith(
        "Invoice Reminder",
        expect.objectContaining({ enabled: 0, use_html: 1 }),
      )
    })
  })

  it("confirms before deleting", async () => {
    vi.mocked(emailTemplateService.delete).mockResolvedValue(undefined)
    await renderPage()

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: /delete/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^delete$/i }))
    })

    await waitFor(() => {
      expect(emailTemplateService.delete).toHaveBeenCalledWith("Invoice Reminder")
    })
  })

  it("surfaces a list failure instead of rendering an empty table", async () => {
    vi.mocked(emailTemplateService.list).mockRejectedValue(new Error("boom"))
    await renderPage()

    expect(await screen.findByText("boom")).toBeInTheDocument()
  })

  it("shows an empty state when no templates exist", async () => {
    vi.mocked(emailTemplateService.list).mockResolvedValue(listResponse([]) as never)
    await renderPage()

    expect(await screen.findByText(/no email templates/i)).toBeInTheDocument()
  })
})