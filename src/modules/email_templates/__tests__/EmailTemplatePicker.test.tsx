import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import EmailTemplatePicker from "@/modules/email_templates/components/EmailTemplatePicker"
import { emailTemplateService } from "@/modules/email_templates/services"

vi.mock("@/modules/email_templates/services", () => ({
  emailTemplateService: {
    names: vi.fn(),
    render: vi.fn(),
  },
}))

const onChange = vi.fn()
const onRendered = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(emailTemplateService.names).mockResolvedValue([
    "Invoice Reminder",
    "Quotation Follow Up",
  ])
  vi.mocked(emailTemplateService.render).mockResolvedValue({
    subject: "Invoice SINV-1 due 2026-10-01",
    message: "<p>Dear AlphaCorp</p>",
  })
})

async function renderPicker() {
  await act(async () => {
    render(
      <EmailTemplatePicker
        doc={{ name: "SINV-1", customer_name: "AlphaCorp" }}
        value=""
        onChange={onChange}
        onRendered={onRendered}
      />,
    )
  })
  await waitFor(() => expect(emailTemplateService.names).toHaveBeenCalled())
}

describe("EmailTemplatePicker", () => {
  it("offers the enabled templates plus the no-template option", async () => {
    await renderPicker()

    const select = screen.getByLabelText(/template/i) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "",
      "Invoice Reminder",
      "Quotation Follow Up",
    ])
  })

  it("renders the chosen template into the caller's subject and body", async () => {
    await renderPicker()

    const select = screen.getByLabelText(/template/i) as HTMLSelectElement
    await act(async () => {
      select.value = "Invoice Reminder"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })

    await waitFor(() => {
      expect(onRendered).toHaveBeenCalledWith({
        subject: "Invoice SINV-1 due 2026-10-01",
        message: "<p>Dear AlphaCorp</p>",
      })
    })
    expect(emailTemplateService.render).toHaveBeenCalledWith("Invoice Reminder", {
      name: "SINV-1",
      customer_name: "AlphaCorp",
    })
    expect(onChange).toHaveBeenCalledWith("Invoice Reminder")
  })

  it("does not call get_email_template when the placeholder is chosen", async () => {
    await renderPicker()

    const select = screen.getByLabelText(/template/i) as HTMLSelectElement
    await act(async () => {
      select.value = "Invoice Reminder"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await waitFor(() => expect(onRendered).toHaveBeenCalled())
    onRendered.mockClear()

    await act(async () => {
      select.value = ""
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })

    expect(onChange).toHaveBeenLastCalledWith("")
    expect(emailTemplateService.render).toHaveBeenCalledTimes(1)
  })

  it("leaves the body untouched when the template cannot be rendered", async () => {
    vi.mocked(emailTemplateService.render).mockResolvedValue(null)
    await renderPicker()

    const select = screen.getByLabelText(/template/i) as HTMLSelectElement
    await act(async () => {
      select.value = "Invoice Reminder"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Invoice Reminder"))
    expect(onRendered).not.toHaveBeenCalled()
  })

  it("shows an empty dropdown when the lookup fails", async () => {
    vi.mocked(emailTemplateService.names).mockResolvedValue([])
    await renderPicker()

    const select = screen.getByLabelText(/template/i) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual([""])
  })
})