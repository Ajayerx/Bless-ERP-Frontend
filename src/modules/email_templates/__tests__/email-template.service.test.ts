import { beforeEach, describe, expect, it, vi } from "vitest"
import { emailTemplateService } from "../services"

// BUG-07: Email Template management (ERPNext parity). `get_email_template`
// answers `{ subject, message }` (plus `message_html` when Use HTML is ticked),
// and the CRUD endpoints are the plain `/resource/Email Template` REST routes.
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("emailTemplateService", () => {
  let urls: string[]
  let lastInit: RequestInit | undefined
  let route: (url: string, init: RequestInit | undefined) => Response

  const lastUrl = (): string => urls[urls.length - 1] ?? ""
  const urlMatching = (needle: string): string =>
    urls.find((u) => u.includes(needle)) ?? ""

  beforeEach(() => {
    urls = []
    lastInit = undefined
    route = () => jsonResponse({ data: [] })
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        urls.push(String(url))
        lastInit = init
        return route(String(url), init)
      }),
    )
  })

  describe("list", () => {
    it("reads { data } rows and derives paging", async () => {
      route = (url) =>
        url.includes("get_count")
          ? jsonResponse({ message: 1 })
          : jsonResponse({ data: [{ name: "Invoice Reminder" }] })

      const result = await emailTemplateService.list({ page: 2, pageSize: 10 })

      expect(result.items).toHaveLength(1)
      expect(result.page).toBe(2)
      expect(result.pageSize).toBe(10)
      expect(result.totalPages).toBe(1)
      const listUrl = urlMatching("/resource/Email%20Template")
      expect(listUrl).toContain("limit_start=10")
      expect(urlMatching("frappe.client.get_count")).not.toBe("")
    })

    it("sends the search and enabled filters as a JSON filters array", async () => {
      await emailTemplateService.list({ search: "invoice", status: "enabled" })

      const filters = JSON.parse(
        new URL(urlMatching("/resource/Email%20Template"), "http://x").searchParams.get("filters") ?? "[]",
      )
      expect(filters).toEqual([
        ["template_name", "like", "%invoice%"],
        ["enabled", "=", 1],
      ])
    })
  })

  describe("names", () => {
    it("asks only for enabled templates ordered by name", async () => {
      route = () => jsonResponse({ data: [{ name: "A" }, { name: "B" }] })

      const names = await emailTemplateService.names()

      expect(names).toEqual(["A", "B"])
      const parsed = new URL(lastUrl(), "http://x")
      expect(JSON.parse(parsed.searchParams.get("fields") ?? "[]")).toEqual(["name"])
      expect(JSON.parse(parsed.searchParams.get("filters") ?? "[]")).toEqual([["enabled", "=", 1]])
      expect(parsed.searchParams.get("order_by")).toBe("template_name asc")
    })

    it("degrades to an empty list rather than throwing", async () => {
      route = () => jsonResponse({ message: "boom" }, 500)
      await expect(emailTemplateService.names()).resolves.toEqual([])
    })
  })

  describe("create / update / delete", () => {
    it("normalises the form doc on create", async () => {
      route = () => jsonResponse({ data: { name: "Payment Request" } })

      await emailTemplateService.create({
        template_name: "  Payment Request  ",
        subject: " Request {{doc.name}} ",
        response: "<p>Hi</p>",
        use_html: 1,
      })

      expect(urlMatching("/resource/Email%20Template")).not.toBe("")
      expect(lastInit?.method).toBe("POST")
      expect(JSON.parse(String(lastInit?.body))).toEqual({
        template_name: "Payment Request",
        subject: "Request {{doc.name}}",
        response: "<p>Hi</p>",
        use_html: 1,
        enabled: 1,
      })
    })

    it("PUTs to the encoded template name on update", async () => {
      route = () => jsonResponse({ data: { name: "Payment Request" } })

      await emailTemplateService.update("Payment Request", {
        template_name: "Payment Request",
        response: "updated",
      })

      expect(lastUrl()).toContain("/resource/Email%20Template/Payment%20Request")
      expect(lastInit?.method).toBe("PUT")
      expect(JSON.parse(String(lastInit?.body)).response).toBe("updated")
    })

    it("DELETEs the encoded template name", async () => {
      route = () => jsonResponse({ data: null })

      await emailTemplateService.delete("Payment Request")

      expect(lastUrl()).toContain("/resource/Email%20Template/Payment%20Request")
      expect(lastInit?.method).toBe("DELETE")
    })
  })

  describe("render", () => {
    it("calls get_email_template with the doc serialised and returns subject + message", async () => {
      route = () =>
        jsonResponse({
          message: { subject: "Invoice INV-1", message: "<p>Dear AlphaCorp</p>" },
        })

      const rendered = await emailTemplateService.render("Invoice Reminder", {
        name: "INV-1",
        customer_name: "AlphaCorp",
      })

      expect(rendered).toEqual({ subject: "Invoice INV-1", message: "<p>Dear AlphaCorp</p>" })
      expect(lastUrl()).toContain(
        "frappe.email.doctype.email_template.email_template.get_email_template",
      )
      // postMethod sends form-encoded params with the doc as a JSON string.
      const sent = new URLSearchParams(String(lastInit?.body))
      expect(sent.get("template_name")).toBe("Invoice Reminder")
      expect(JSON.parse(sent.get("doc") ?? "{}")).toEqual({
        name: "INV-1",
        customer_name: "AlphaCorp",
      })
    })

    it("falls back to message_html when the server answers with it", async () => {
      route = () => jsonResponse({ message: { subject: "S", message_html: "<p>html</p>" } })

      await expect(emailTemplateService.render("T", {})).resolves.toEqual({
        subject: "S",
        message: "<p>html</p>",
      })
    })

    it("returns null instead of throwing when the template is missing", async () => {
      route = () => jsonResponse({ message: "Email Template X not found" }, 404)

      await expect(emailTemplateService.render("X", {})).resolves.toBeNull()
    })
  })
})