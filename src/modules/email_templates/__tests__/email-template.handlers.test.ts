import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest"
import { setupServer } from "msw/node"
import { emailTemplateService } from "../services"
import {
  emailTemplateHandlers,
  resetEmailTemplates,
} from "@/mocks/handlers/email-templates"

/**
 * The Vitest suite normally runs against the monolithic `src/mocks/server.ts`.
 * These tests instead drive the browser-mode handler module over a real
 * `fetch`, which is what catches path-matching mistakes such as
 * `/api/resource/Email Template` never matching the encoded
 * `/api/resource/Email%20Template` the client actually requests.
 */
const server = setupServer(...emailTemplateHandlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" })
})

afterAll(() => {
  server.close()
})

afterEach(() => {
  resetEmailTemplates()
})

describe("emailTemplateHandlers in browser mode", () => {
  it("lists templates from the encoded resource path", async () => {
    const result = await emailTemplateService.list({ pageSize: 0 })

    expect(result.items.length).toBeGreaterThan(0)
    expect(result.total).toBe(result.items.length)
    // `pageSize: 0` means "no paging" and must not divide by zero.
    expect(result.totalPages).toBe(1)
    expect(result.items[0].subject).toBeTruthy()
  })

  it("honours the enabled filter and the template_name search", async () => {
    const enabled = await emailTemplateService.list({ status: "enabled", pageSize: 0 })
    expect(enabled.items.every((t) => t.enabled === 1)).toBe(true)

    const first = enabled.items[0]
    const searched = await emailTemplateService.list({
      search: first.template_name,
      pageSize: 0,
    })
    expect(searched.items.map((t) => t.name)).toContain(first.name)
  })

  it("counts rows through the GET get_count endpoint", async () => {
    const result = await emailTemplateService.list({ pageSize: 0 })
    expect(typeof result.total).toBe("number")
    expect(result.total).toBeGreaterThan(0)
  })

  it("fetches a single template by name, including the body", async () => {
    const listed = await emailTemplateService.list({ pageSize: 0 })
    const single = await emailTemplateService.getById(listed.items[0].name)

    expect(single.name).toBe(listed.items[0].name)
    expect(single.response).toBeTruthy()
  })

  it("renders a template against a document through get_email_template", async () => {
    const listed = await emailTemplateService.list({ pageSize: 0 })
    const template = listed.items.find((t) => t.use_html === 1)
    expect(template).toBeDefined()

    const rendered = await emailTemplateService.render(template!.name, {
      name: "SINV-0001",
      customer_name: "AlphaCorp",
      due_date: "2026-10-01",
    })

    expect(rendered).not.toBeNull()
    expect(rendered!.subject).toContain("SINV-0001")
    expect(rendered!.message).toContain("AlphaCorp")
  })

  it("creates, updates and deletes a template over the REST endpoints", async () => {
    const created = await emailTemplateService.create({
      template_name: "Browser Mode Probe",
      subject: "Invoice {{doc.name}} for {{doc.customer_name}}",
      response: "<p>Hi {{doc.customer_name}}</p>",
      use_html: 1,
      enabled: 1,
    })
    expect(created.name).toBe("Browser Mode Probe")

    const fetched = await emailTemplateService.getById("Browser Mode Probe")
    expect(fetched.subject).toContain("{{doc.name}}")

    await emailTemplateService.update("Browser Mode Probe", {
      template_name: "Browser Mode Probe",
      subject: "Updated",
      response: fetched.response,
      use_html: 1,
      enabled: 0,
    })
    const updated = await emailTemplateService.getById("Browser Mode Probe")
    expect(updated.subject).toBe("Updated")
    expect(updated.enabled).toBe(0)

    await emailTemplateService.delete("Browser Mode Probe")
    await expect(emailTemplateService.getById("Browser Mode Probe")).rejects.toThrow()
  })

  it("returns null when a template name is unknown", async () => {
    expect(await emailTemplateService.render("No Such Template", { name: "X" })).toBeNull()
  })
})