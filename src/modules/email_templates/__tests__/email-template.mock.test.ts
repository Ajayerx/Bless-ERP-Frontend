import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"

import { emailTemplateService } from "@/modules/email_templates/services"
import { server, resetFixtures } from "@/mocks/server"

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
afterAll(() => server.close())
beforeEach(() => resetFixtures())

// BUG-07: the Email Template REST surface must honour the same wire contract the
// real ERPNext resource exposes, because the management page, the picker and
// the send dialogs all go through it.
describe("Email Template endpoints (node mock server)", () => {
  it("lists only enabled templates by name for the picker", async () => {
    const names = await emailTemplateService.names()
    expect(names).toContain("Invoice Reminder")
    expect(names).toContain("Quotation Follow Up")
  })

  it("round-trips create -> get -> list -> update -> delete", async () => {
    const created = await emailTemplateService.create({
      template_name: "Payment Request",
      subject: "Payment for {{doc.name}}",
      response: "<p>Please pay invoice {{doc.name}}.</p>",
      use_html: 1,
    })
    expect(created.name).toBe("Payment Request")

    await expect(emailTemplateService.getById("Payment Request")).resolves.toMatchObject({
      subject: "Payment for {{doc.name}}",
    })

    const afterCreate = await emailTemplateService.list({ search: "Payment" })
    expect(afterCreate.items.map((t) => t.name)).toContain("Payment Request")

    const updated = await emailTemplateService.update("Payment Request", {
      template_name: "Payment Request",
      response: "<p>Updated body.</p>",
    })
    expect(updated.response).toBe("<p>Updated body.</p>")

    await emailTemplateService.delete("Payment Request")
    const afterDelete = await emailTemplateService.list({ search: "Payment" })
    expect(afterDelete.items.map((t) => t.name)).not.toContain("Payment Request")
  })

  it("filters the list by enabled flag", async () => {
    const all = await emailTemplateService.list({})
    expect(all.total).toBeGreaterThanOrEqual(2)

    await emailTemplateService.update("Quotation Follow Up", {
      template_name: "Quotation Follow Up",
      subject: "Quotation {{doc.name}}",
      response: "<p>Hi</p>",
      enabled: 0,
    })

    const enabled = await emailTemplateService.list({ status: "enabled" })
    expect(enabled.items.map((t) => t.name)).not.toContain("Quotation Follow Up")
    expect(enabled.total).toBe(enabled.items.length)

    const disabled = await emailTemplateService.list({ status: "disabled" })
    expect(disabled.items.map((t) => t.name)).toContain("Quotation Follow Up")
  })

  it("substitutes doc fields when rendering a template", async () => {
    const rendered = await emailTemplateService.render("Invoice Reminder", {
      name: "SINV-0001",
      customer_name: "AlphaCorp",
      due_date: "2026-10-01",
      grand_total: 229.95,
    })

    expect(rendered?.subject).toBe("Invoice SINV-0001 due on 2026-10-01")
    expect(rendered?.message).toContain("AlphaCorp")
    expect(rendered?.message).toContain("SINV-0001")
    expect(rendered?.message).not.toContain("{{doc.")
  })

  it("reports a missing template rather than rendering a stub", async () => {
    await expect(emailTemplateService.render("Nope", {})).resolves.toBeNull()
  })
})