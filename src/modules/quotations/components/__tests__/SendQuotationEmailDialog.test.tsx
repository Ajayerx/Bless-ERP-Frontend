import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import SendQuotationEmailDialog from "@/modules/quotations/components/SendQuotationEmailDialog"
import { quotationService } from "@/modules/quotations/services"
import { emailTemplateService } from "@/modules/email_templates/services"

vi.mock("@/modules/quotations/services", () => ({
  quotationService: {
    getPrintFormats: vi.fn(),
    sendEmail: vi.fn(),
  },
}))

vi.mock("@/modules/email_templates/services", () => ({
  emailTemplateService: {
    names: vi.fn(),
    render: vi.fn(),
  },
}))

const onOpenChange = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  vi.mocked(quotationService.getPrintFormats).mockResolvedValue([
    "Standard",
    "Quotation Landscape",
  ])
  vi.mocked(quotationService.sendEmail).mockResolvedValue({ name: "COMM-00002" })
  vi.mocked(emailTemplateService.names).mockResolvedValue(["Quotation Reminder"])
  vi.mocked(emailTemplateService.render).mockResolvedValue({
    subject: "Quotation QTN-0001 for AlphaCorp",
    message: "<p>Dear AlphaCorp</p>",
  })
})

afterEach(() => {
  vi.useRealTimers()
})

async function renderDialog(props: Partial<React.ComponentProps<typeof SendQuotationEmailDialog>> = {}) {
  await act(async () => {
    render(
      <SendQuotationEmailDialog
        open
        onOpenChange={onOpenChange}
        quotationName="QTN-0001"
        contactEmail="alpha@example.com"
        customerName="AlphaCorp"
        {...props}
      />,
    )
  })
  await waitFor(() => expect(quotationService.getPrintFormats).toHaveBeenCalled())
}

async function clickSend() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }))
  })
}

describe("SendQuotationEmailDialog", () => {
  it("pre-fills the recipient, subject and default body", async () => {
    await renderDialog()

    expect(screen.getByLabelText(/^to$/i)).toHaveValue("alpha@example.com")
    expect(screen.getByLabelText(/subject/i)).toHaveValue("Quotation QTN-0001")
    expect(screen.getByLabelText(/message/i).getAttribute("value")).toBeNull()
    expect(
      (screen.getByLabelText(/message/i) as HTMLTextAreaElement).value,
    ).toContain("Please find attached quotation QTN-0001")
  })

  it("lists the server's print formats and defaults to Standard", async () => {
    await renderDialog()

    const select = screen.getByLabelText(/print format/i) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "Standard",
      "Quotation Landscape",
    ])
    expect(select.value).toBe("Standard")
  })

  it("attaches the PDF by default and lets the user opt out", async () => {
    await renderDialog()

    const attachPdf = screen.getByRole("checkbox", { name: /attach pdf/i })
    expect(attachPdf).toBeChecked()

    await act(async () => {
      fireEvent.click(attachPdf)
    })
    await clickSend()

    expect(quotationService.sendEmail).toHaveBeenCalledWith(
      "QTN-0001",
      expect.objectContaining({ attachPdf: false }),
    )
  })

  it("passes the chosen print format through", async () => {
    await renderDialog()

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/print format/i), {
        target: { value: "Quotation Landscape" },
      })
    })
    await clickSend()

    expect(quotationService.sendEmail).toHaveBeenCalledWith(
      "QTN-0001",
      expect.objectContaining({ printFormat: "Quotation Landscape" }),
    )
  })

  it("renders a picked template into the subject and message", async () => {
    await renderDialog()

    const select = screen.getByLabelText(/template/i) as HTMLSelectElement
    await act(async () => {
      select.value = "Quotation Reminder"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })

    await waitFor(() =>
      expect(emailTemplateService.render).toHaveBeenCalledWith("Quotation Reminder", {
        name: "QTN-0001",
        customer_name: "AlphaCorp",
      }),
    )
    await waitFor(() =>
      expect(screen.getByLabelText(/subject/i)).toHaveValue("Quotation QTN-0001 for AlphaCorp"),
    )
    expect(screen.getByLabelText(/message/i)).toHaveValue("<p>Dear AlphaCorp</p>")
  })

  it("prefers the caller's doc fields when they are supplied", async () => {
    await renderDialog({
      doc: { name: "QTN-0001", customer_name: "BetaCorp", valid_till: "2026-10-05" },
    })

    const select = screen.getByLabelText(/template/i) as HTMLSelectElement
    await act(async () => {
      select.value = "Quotation Reminder"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })

    await waitFor(() =>
      expect(emailTemplateService.render).toHaveBeenCalledWith("Quotation Reminder", {
        name: "QTN-0001",
        customer_name: "BetaCorp",
        valid_till: "2026-10-05",
      }),
    )
  })

  it("converts newlines to <br> unless Use HTML is ticked", async () => {
    await renderDialog()

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/message/i), {
        target: { value: "Line one\nLine two" },
      })
    })
    await clickSend()

    expect(quotationService.sendEmail).toHaveBeenCalledWith(
      "QTN-0001",
      expect.objectContaining({
        content: "Line one<br>Line two",
        sendHtml: false,
      }),
    )
  })

  it("sends the message verbatim when Use HTML is ticked", async () => {
    await renderDialog()

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: /use html/i }))
      fireEvent.change(screen.getByLabelText(/message/i), {
        target: { value: "<p>Line one\nLine two</p>" },
      })
    })
    await clickSend()

    expect(quotationService.sendEmail).toHaveBeenCalledWith(
      "QTN-0001",
      expect.objectContaining({
        content: "<p>Line one\nLine two</p>",
        sendHtml: true,
      }),
    )
  })

  it("trims the recipient before sending", async () => {
    await renderDialog()

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^to$/i), {
        target: { value: "  alpha@example.com  " },
      })
    })
    await clickSend()

    expect(quotationService.sendEmail).toHaveBeenCalledWith(
      "QTN-0001",
      expect.objectContaining({ recipients: "alpha@example.com" }),
    )
  })

  it("refuses to send without a recipient", async () => {
    await renderDialog({ contactEmail: "" })

    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^send$/i }))
    })
    expect(quotationService.sendEmail).not.toHaveBeenCalled()
  })

  it("shows the success state and closes after the delay", async () => {
    await renderDialog()

    // Fake timers only after the async render, so the `waitFor` above still works.
    vi.useFakeTimers()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^send$/i }))
    })

    expect(screen.getByText(/email sent successfully/i)).toBeInTheDocument()

    // The dialog closes on a 1.5s timer; assert it stays open until then.
    expect(onOpenChange).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("surfaces a send failure", async () => {
    vi.mocked(quotationService.sendEmail).mockRejectedValue(new Error("SMTP refused"))
    await renderDialog()

    await clickSend()

    expect(await screen.findByText("SMTP refused")).toBeInTheDocument()
    expect(screen.queryByText(/email sent successfully/i)).not.toBeInTheDocument()
  })
})