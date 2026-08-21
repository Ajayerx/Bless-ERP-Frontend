import { http, HttpResponse, delay } from "msw"
import { salesInvoices, salesInvoiceItems, salesInvoiceTaxes } from "./frappe-lookups"

// ERPNext-style timeline data for Payment Entry documents in dev mode,
// served via the exact endpoints ERPNext uses:
//   frappe.desk.form.load.get_docinfo  (reads comments + versions)
//   frappe.desk.form.utils.add_comment (comment composer)

interface CommentRow {
  name: string
  communication_type: string
  content: string
  owner: string
  creation: string
  reference_doctype: string
  reference_name: string
}

interface VersionRow {
  name: string
  owner: string
  creation: string
  ref_doctype: string
  docname: string
  data: string
}

let comments: CommentRow[] = [
  {
    name: "COM-0001",
    communication_type: "Comment",
    content: "Please verify the payment details before submission.",
    owner: "admin@blesserp.com",
    creation: "2026-07-02T12:30:00",
    reference_doctype: "Payment Entry",
    reference_name: "PAY-2026-0001",
  },
  {
    name: "COM-VER-0002",
    communication_type: "Comment",
    content: "Please review the remarks on this version.",
    owner: "admin@blesserp.com",
    creation: "2026-07-02T12:20:00",
    reference_doctype: "Version",
    reference_name: "VER-0002",
  },
  {
    name: "COM-SINV-0001",
    communication_type: "Comment",
    content: "Please confirm the due date with Maple Leaf Bakery before sending.",
    owner: "jane.doe@blesserp.com",
    creation: "2026-07-05T09:15:00",
    reference_doctype: "Sales Invoice",
    reference_name: "SINV-2026-0001",
  },
]

const versions: VersionRow[] = [
  {
    name: "VER-0001",
    owner: "admin@blesserp.com",
    creation: "2026-07-02T12:15:00",
    ref_doctype: "Payment Entry",
    docname: "PAY-2026-0001",
    data: JSON.stringify({ changed: [["docstatus", 0, 1]] }),
  },
  {
    name: "VER-0002",
    owner: "admin@blesserp.com",
    creation: "2026-07-02T12:10:00",
    ref_doctype: "Payment Entry",
    docname: "PAY-2026-0001",
    data: JSON.stringify({
      changed: [
        ["party_name", "Rajesh", "Raj"],
        [
          "remarks",
          "Amount CAD 100 received from Sunrise Grocery Store for invoice payment. This longer remark demonstrates the server-side HTML diff view in the ERPNext Version form.",
          "Amount CAD 100.0 received from Sunrise Grocery Store and vendor payment pending. Please confirm the exact figure and the vendor balance after this allocation.",
        ],
      ],
    }),
  },
  {
    name: "VER-0003",
    owner: "admin@blesserp.com",
    creation: "2026-07-02T13:00:00",
    ref_doctype: "Payment Entry",
    docname: "ACC-PAY-0002",
    data: JSON.stringify({
      changed: [
        [
          "remarks",
          "Amount CAD 897 received from Hemant<br>Transaction reference no dsfdgsdg dated 2026-08-11<br>Amount CAD 862 against Sales Invoice ACC-SINV-2026-00066",
          "Amount CAD 897.0 received from Hemant<br>Transaction reference no dsfdgsdg dated 2026-08-11<br>Amount CAD 862.0 against Sales Invoice ACC-SINV-2026-00066",
        ],
      ],
    }),
  },
  {
    name: "VER-0004",
    owner: "admin@blesserp.com",
    creation: "2026-07-02T13:05:00",
    ref_doctype: "Payment Entry",
    docname: "ACC-PAY-0002",
    data: JSON.stringify({
      changed: [
        [
          "remarks",
          "Short note first line<br>short note second line",
          "Short note first line<br>short note second line updated",
        ],
      ],
    }),
  },
  {
    name: "VER-SINV-0001",
    owner: "admin@blesserp.com",
    creation: "2026-07-02T12:18:00",
    ref_doctype: "Sales Invoice",
    docname: "SINV-2026-0001",
    data: JSON.stringify({
      changed: [
        ["outstanding_amount", 0, 2450],
        ["status", "Unpaid", "Paid"],
      ],
    }),
  },
]

let commentCounter = 0

// Approximates the difflib.HtmlDiff table frappe's Version.onload puts in
// doc.__onload.html_diffs for long text fields such as remarks.
function versionHtmlDiff(oldStr: string, newStr: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return (
    '<table class="diff">' +
    '<colgroup></colgroup><colgroup></colgroup><colgroup class="content"></colgroup><colgroup class="content"></colgroup>' +
    '<tr><th colspan="2">Original</th><th colspan="2">New</th></tr>' +
    '<tr class="replace">' +
    '<td class="diff_header">1</td><td class="diff_next"></td>' +
    '<td class="diff_header">1</td><td class="diff_next"></td>' +
    `<td class="diff_sub">${esc(oldStr)}</td>` +
    `<td class="diff_add">${esc(newStr)}</td>` +
    "</tr>" +
    "</table>"
  )
}

function versionHtmlDiffs(data: string): Record<string, string> {
  let parsed: { changed?: unknown[][] } = {}
  try {
    parsed = JSON.parse(data) as { changed?: unknown[][] }
  } catch {
    return {}
  }
  const out: Record<string, string> = {}
  for (const item of parsed.changed ?? []) {
    if (Array.isArray(item) && item.length >= 3 && typeof item[0] === "string") {
      const oldStr = String(item[1] ?? "")
      const newStr = String(item[2] ?? "")
      // Mirrors Version._should_generate_html_diff: only diff long/multiline text.
      if (oldStr && newStr && (oldStr.includes("\n") || newStr.includes("\n") || oldStr.length > 80 || newStr.length > 80)) {
        out[item[0]] = versionHtmlDiff(oldStr, newStr)
      }
    }
  }
  return out
}

// ── Assignments & Tags (ERPNext form sidebar: get_docinfo + assign_to.* / tag.*) ──

interface MockAssignment {
  name: string
  owner: string
  description?: string
  status: string
}

const assignmentStore: Record<string, MockAssignment[]> = {}
const tagStore: Record<string, string[]> = {}
let assignmentCounter = 0

const docKey = (doctype: string, name: string) => `${doctype}::${name}`

// Seed so the demo view shows a living state without any interaction.
for (const [key, list] of Object.entries({
  [docKey("Payment Entry", "PAY-2026-0001")]: [
    { name: "Todo-PAY-0001", owner: "admin@blesserp.com", status: "Open" },
  ],
  [docKey("Payment Entry", "PAY-2026-0002")]: [
    { name: "Todo-PAY-0002", owner: "aarav@blesserp.com", status: "Open" },
    { name: "Todo-PAY-0003", owner: "jane.doe@blesserp.com", status: "Pending" },
  ],
  [docKey("Sales Invoice", "SINV-2026-0001")]: [
    { name: "Todo-SINV-0001", owner: "jane.doe@blesserp.com", status: "Open" },
  ],
} as Record<string, MockAssignment[]>)) {
  assignmentStore[key] = list
}
for (const [key, list] of Object.entries({
  [docKey("Payment Entry", "PAY-2026-0001")]: ["Audit", "Q1-Review"],
  [docKey("Payments", "PAY-2026-0002")]: ["Follow-up"],
  [docKey("Sales Invoice", "SINV-2026-0001")]: ["Audit", "Needs-Review"],
})) {
  tagStore[key] = list
}

// ErpNext's form.load.getdoc response: the full document (top-level fields +
// child tables, doctype/name/parent linking) in `docs[]` plus docinfo. The
// custom form consumes exactly this and nothing else when opening an invoice.
type SalesInvoiceRow = Record<string, unknown>

// fmt_money parity (en-US, 2 dp) used to build the stored break-up HTML.
const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const round2 = (n: number) => Math.round(n * 100) / 100

// Mirrors erpnext.controllers.taxes_and_totals.get_itemised_tax_breakup_html:
// the pre-rendered "Tax Breakup" HTML that ERPNext stores on the doc at save
// time (other_charges_calculation) and the form re-renders verbatim.
function itemisedTaxBreakupHtml(
  items: Array<{ item_code: string; qty: number; rate: number }>,
  taxes: Array<{ description: string; rate: number }>,
): string {
  const descriptions = Array.from(new Set(taxes.map((t) => t.description)))
  const rowsHtml = items
    .map((item) => {
      const taxable = round2(item.qty * item.rate)
      const cells = descriptions
        .map((desc) => {
          const tax = taxes.find((t) => t.description === desc)
          const amount = round2((taxable * (tax?.rate ?? 0)) / 100)
          return `<td class="text-right">(${tax?.rate}%) ${money(amount)}</td>`
        })
        .join("")
      return `<tr><td>${item.item_code}</td><td class="text-right">${money(taxable)}</td>${cells}</tr>`
    })
    .join("")
  const headers = descriptions.map((d) => `<th class="text-right">${d}</th>`).join("")
  return `<div class="tax-break-up" style="overflow-x: auto;">
<table class="table table-bordered table-hover">
<thead><tr><th class="text-left">Item</th><th class="text-right">Taxable Amount</th>${headers}</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
</div>`
}

function fullSalesInvoiceDoc(row: SalesInvoiceRow): SalesInvoiceRow {
  const itemRows = salesInvoiceItems.map((it, i) => ({
    doctype: "Sales Invoice Item",
    name: `SI-ROW-${row.name}-${i + 1}`,
    parent: row.name,
    parentfield: "items",
    parenttype: "Sales Invoice",
    idx: i + 1,
    ...it,
  }))
  const taxRowsWithDetail: Array<Record<string, unknown>> = salesInvoiceTaxes.map((t, i) => {
    // ERPNext stores per-item detail as base-currency JSON on each tax row.
    const detail: Record<string, [number, number]> = {}
    for (const it of itemRows) {
      const base = round2(Number(it.qty) * Number(it.rate))
      detail[String(it.item_code)] = [t.rate, round2((base * t.rate) / 100)]
    }
    return {
      doctype: "Sales Taxes and Charges",
      name: `SI-TAX-${row.name}-${i + 1}`,
      parent: row.name,
      parentfield: "taxes",
      parenttype: "Sales Invoice",
      idx: i + 1,
      category: "Total",
      item_wise_tax_detail: JSON.stringify(detail),
      ...t,
    }
  })
  return {
    doctype: "Sales Invoice",
    name: row.name,
    customer: row.customer,
    customer_name: row.customer_name,
    company: "Bless Inc.",
    currency: "CAD",
    selling_price_list: "Standard Selling",
    posting_date: row.posting_date,
    due_date: row.due_date,
    status: row.status,
    docstatus: row.docstatus,
    owner: row.owner,
    creation: row.creation,
    modified: row.modified,
    modified_by: row.modified_by,
    net_total: row.grand_total,
    total: row.grand_total,
    grand_total: row.grand_total,
    rounded_total: row.grand_total,
    outstanding_amount: row.outstanding_amount,
    conversion_rate: 1,
    plc_conversion_rate: 1,
    company_tax_id: "BSL-2026-0001",
    debit_to: "Debtors - BE",
    cost_center: "Main - BE",
    taxes_and_charges: "Canada GST/QST - BE",
    // Stored "Tax Breakup" HTML, exactly like a real ERPNext save produces.
    other_charges_calculation: itemisedTaxBreakupHtml(
      itemRows as Array<{ item_code: string; qty: number; rate: number }>,
      salesInvoiceTaxes,
    ),
    items: itemRows,
    taxes: taxRowsWithDetail,
  }
}

// Shared docinfo payload served by BOTH get_docinfo (timeline refresh) and
// getdoc (opening the form), so the two endpoints can never drift apart.
function buildDocInfo(doctype: string, name: string) {
  return {
    doctype,
    name,
    comments: comments
      .filter((c) => c.reference_doctype === doctype && (!name || c.reference_name === name))
      .map((c) => ({
        name: c.name,
        comment_type: "Comment",
        comment_email: c.owner,
        comment_by: c.owner,
        creation: c.creation,
        content: c.content,
        owner: c.owner,
      })),
    versions: versions
      .filter((v) => v.ref_doctype === doctype && (!name || v.docname === name))
      .map((v) => ({ name: v.name, creation: v.creation, owner: v.owner, data: v.data })),
    user_info: {
      "admin@blesserp.com": { fullname: "Administrator" },
    },
    assignments: (assignmentStore[docKey(doctype, name)] ?? []).filter(
      (a) => a.status !== "Closed" && a.status !== "Cancelled"
    ),
    tags: (tagStore[docKey(doctype, name)] ?? []).join(", "),
    permissions: {
      read: true,
      write: true,
      create: true,
      delete: true,
      submit: true,
      cancel: true,
      amend: true,
    },
  }
}

export const activityHandlers = [
  // ── open doc: single request returning doclist + docinfo ──────────
  // Byte-for-byte the endpoint ERPNext's form controller (Form.load_doc /
  // form.load.getdoc) serves. The custom form makes exactly ONE call here.
  http.get("/api/method/frappe.desk.form.load.getdoc", async ({ request }) => {
    await delay(60)
    const url = new URL(request.url)
    const name = url.searchParams.get("name") ?? ""
    const row = salesInvoices.find((s) => s.name === name)
    if (!row) return HttpResponse.json({ message: `Sales Invoice ${name} not found` }, { status: 404 })
    return HttpResponse.json({
      docs: [fullSalesInvoiceDoc(row as SalesInvoiceRow)],
      docinfo: buildDocInfo("Sales Invoice", name),
    })
  }),

  // ── docinfo: comments + versions + user_info ──────────────────────
  http.get("/api/method/frappe.desk.form.load.get_docinfo", async ({ request }) => {
    await delay(60)
    const url = new URL(request.url)
    const name = url.searchParams.get("name") ?? ""
    const doctype = url.searchParams.get("doctype") ?? "Sales Invoice"
    return HttpResponse.json({
      docinfo: buildDocInfo(doctype, name),
    })
  }),

  // ── single Version doc (target of clickable version messages) ──
  http.get("/api/resource/Version/:name", async ({ params }) => {
    await delay(60)
    const version = versions.find((v) => v.name === params.name)
    if (!version) return HttpResponse.json({ message: `Version ${params.name} not found` }, { status: 404 })
    return HttpResponse.json({
      data: {
        name: version.name,
        doctype: "Version",
        ref_doctype: version.ref_doctype,
        docname: version.docname,
        data: version.data,
        owner: version.owner,
        creation: version.creation,
        modified: version.creation,
        modified_by: version.owner,
        __onload: { html_diffs: versionHtmlDiffs(version.data) },
      },
    })
  }),

  // ── add_comment: creates a Comment that get_docinfo returns next ──
  http.post("/api/method/frappe.desk.form.utils.add_comment", async ({ request }) => {
    await delay(60)
    const body = (await request.formData().catch(() => new FormData())) as FormData
    commentCounter += 1
    const created: CommentRow = {
      name: `COM-NEW-${commentCounter}`,
      communication_type: "Comment",
      content: String(body.get("content") ?? ""),
      owner: "admin@blesserp.com",
      creation: new Date().toISOString(),
      reference_doctype: String(body.get("reference_doctype") ?? "Payment Entry"),
      reference_name: String(body.get("reference_name") ?? ""),
    }
    comments = [created, ...comments]
    return HttpResponse.json({
      message: {
        name: created.name,
        content: created.content,
        owner: created.owner,
        creation: created.creation,
      },
    })
  }),

  // ── update_comment: timeline edit (owner / Administrator only) ──
  http.post("/api/method/frappe.desk.form.utils.update_comment", async ({ request }) => {
    await delay(60)
    const body = (await request.formData().catch(() => new FormData())) as FormData
    const name = String(body.get("name") ?? "")
    const target = comments.find((c) => c.name === name)
    if (!target) return HttpResponse.json({ message: `Comment ${name} not found` }, { status: 404 })
    target.content = String(body.get("content") ?? "")
    return HttpResponse.json({
      message: {
        name: target.name,
        content: target.content,
        owner: target.owner,
        creation: target.creation,
      },
    })
  }),

  // ── client.delete: comment deletion ──
  http.post("/api/method/frappe.client.delete", async ({ request }) => {
    await delay(60)
    const body = (await request.formData().catch(() => new FormData())) as FormData
    const doctype = String(body.get("doctype") ?? "")
    const name = String(body.get("name") ?? "")
    if (doctype === "Comment") {
      comments = comments.filter((c) => c.name !== name)
      return HttpResponse.json({ message: name })
    }
    return HttpResponse.json({ message: `Cannot delete ${doctype}` }, { status: 400 })
  }),

  // ── assign_to.add: assign one doc to one or more users (form sidebar) ──
  http.post("/api/method/frappe.desk.form.assign_to.add", async ({ request }) => {
    await delay(60)
    const body = (await request.formData().catch(() => new FormData())) as FormData
    const doctype = String(body.get("doctype") ?? "Payment Entry")
    const name = String(body.get("name") ?? "")
    let assignees: string[] = []
    try {
      assignees = JSON.parse(String(body.get("assign_to") ?? "[]"))
    } catch {
      assignees = []
    }
    const key = docKey(doctype, name)
    const list = assignmentStore[key] ?? []
    for (const user of assignees) {
      if (!list.some((a) => a.owner === user)) {
        assignmentCounter += 1
        list.push({ name: `Todo-${doctype}-${assignmentCounter}`, owner: user, status: "Open" })
      }
    }
    assignmentStore[key] = list
    return HttpResponse.json({ message: "Document assigned" })
  }),

  // ── assign_to.remove (explicit unassign) ──
  http.post("/api/method/frappe.desk.form.assign_to.remove", async ({ request }) => {
    await delay(60)
    const body = (await request.formData().catch(() => new FormData())) as FormData
    const doctype = String(body.get("doctype") ?? "Payment Entry")
    const name = String(body.get("name") ?? "")
    const user = String(body.get("assign_to") ?? "")
    const key = docKey(doctype, name)
    assignmentStore[key] = (assignmentStore[key] ?? []).filter((a) => a.owner !== user)
    return HttpResponse.json({ message: "Assignments updated" })
  }),

  // ── assign_to.close: assignee marks their own To-do done (drops it from docinfo) ──
  http.post("/api/method/frappe.desk.form.assign_to.close", async ({ request }) => {
    await delay(60)
    const body = (await request.formData().catch(() => new FormData())) as FormData
    const doctype = String(body.get("doctype") ?? "Payment Entry")
    const name = String(body.get("name") ?? "")
    const user = String(body.get("assign_to") ?? "")
    const key = docKey(doctype, name)
    const target = (assignmentStore[key] ?? []).find((a) => a.owner === user)
    if (target) target.status = "Closed"
    return HttpResponse.json({ message: "Assignment closed" })
  }),

  // ── tag.add_tag / remove_tag (form sidebar TagEditor) ──
  http.post("/api/method/frappe.desk.doctype.tag.tag.add_tag", async ({ request }) => {
    await delay(60)
    const body = (await request.formData().catch(() => new FormData())) as FormData
    const dt = String(body.get("dt") ?? "Payment Entry")
    const dn = String(body.get("dn") ?? "")
    const tag = String(body.get("tag") ?? "").trim()
    const key = docKey(dt, dn)
    if (tag) {
      const list = tagStore[key] ?? []
      if (!list.includes(tag)) list.push(tag)
      tagStore[key] = list
    }
    return HttpResponse.json({ message: "Tag added" })
  }),

  http.post("/api/method/frappe.desk.doctype.tag.tag.remove_tag", async ({ request }) => {
    await delay(60)
    const body = (await request.formData().catch(() => new FormData())) as FormData
    const dt = String(body.get("dt") ?? "Payment Entry")
    const dn = String(body.get("dn") ?? "")
    const tag = String(body.get("tag") ?? "").trim()
    const key = docKey(dt, dn)
    tagStore[key] = (tagStore[key] ?? []).filter((t) => t !== tag)
    return HttpResponse.json({ message: "Tag removed" })
  }),

  // ── tag.get_tags: augment the tag input with existing Tag master names ──
  http.post("/api/method/frappe.desk.doctype.tag.tag.get_tags", async ({ request }) => {
    await delay(60)
    const body = (await request.formData().catch(() => new FormData())) as FormData
    const txt = String(body.get("txt") ?? "").toLowerCase()
    const all = Array.from(new Set(Object.values(tagStore).flat()))
    const hits = all.filter((t) => t.toLowerCase().includes(txt)).slice(0, 10)
    return HttpResponse.json({ message: hits })
  }),
]
