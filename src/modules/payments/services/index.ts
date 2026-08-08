import { apiClient, apiClientWithBody, serverMessagesFromBody, type AppMessage } from "@/services/api-client"
import { API_CONFIG } from "@/config/api.config"
import { sanitizeHtml } from "@/lib/utils"
import { postMethod, postMethodRaw, withDedup } from "@/services/frappe-client"
import type { SalesInvoice } from "@/modules/invoices/services"
import type {
  PaymentEntry,
  PaymentEntryListResponse,
  PartyDetails,
  AccountDetails,
  OutstandingReference,
  GetOutstandingArgs,
  RecordPaymentData,
  PaymentEntryTax,
  PaymentComment,
  PaymentActivityItem,
  LedgerPreviewData,
  ContactDetails,
  BankAccountDetails,
  PartyAndAccountBalance,
  UnreconcileAllocation,
  PaymentAfterSaveResult,
  DocInfo,
  DocInfoVersion,
  DocInfoUserInfo,
  ActivityMessageSegment,
  VersionDoc,
} from "../types"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function buildListUrl(
  doctype: string,
  params: {
    fields: string[]
    filters?: unknown[]
    orFilters?: unknown[]
    limit_page_length?: number
    limit_start?: number
    order_by?: string
  }
): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  if (params.orFilters && params.orFilters.length > 0) {
    qp.set("or_filters", JSON.stringify(params.orFilters))
  }
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent(doctype)}?${qp.toString()}`
}

// count via frappe.desk.reportview.get_count: it's the endpoint ERPNext's own
// list view uses (frappe.db.count -> reportview.get_count) and the only count
// endpoint that accepts a top-level `or_filters` for the list search.
async function getCount(
  doctype: string,
  filters?: unknown[],
  orFilters?: unknown[]
): Promise<number> {
  const qp = new URLSearchParams()
  qp.set("doctype", doctype)
  if (filters) qp.set("filters", JSON.stringify(filters))
  if (orFilters && orFilters.length > 0) qp.set("or_filters", JSON.stringify(orFilters))
  const result = await apiClient<number | string>(
    `/method/frappe.desk.reportview.get_count?${qp.toString()}`
  )
  return Number(result)
}

const LIST_FIELDS = [
  "name", "payment_type", "party_type", "posting_date", "party", "party_name", "title",
  "paid_amount", "received_amount", "mode_of_payment",
  "reference_no", "status", "docstatus", "company",
  "_assign", "_user_tags",
]

// Default columns for the server-side exporter. download_template 500s when
// export_fields is null (exporter.py iterates .items()), so we always send an
// object. Keys are the parent doctype ("Payment Entry") and the child-table
// field name ("references" -> "Payment Entry Reference" rows), matching the
// ERPNext Data Export format.
export const PAYMENT_EXPORT_FIELDS: Record<string, string[]> = {
  "Payment Entry": [
    "name", "title", "payment_type", "party_type", "party", "party_name",
    "posting_date", "company", "mode_of_payment", "paid_from", "paid_to",
    "paid_amount", "received_amount", "reference_no", "status", "docstatus",
  ],
  references: [
    "reference_doctype", "reference_name", "total_amount",
    "outstanding_amount", "allocated_amount",
  ],
}

export type { PaymentEntry, PaymentEntryListResponse, RecordPaymentData, PaymentEntryReference, PartyDetails, AccountDetails, OutstandingReference, GetOutstandingArgs, LedgerPreviewData, LedgerPreviewColumn, ContactDetails, BankAccountDetails, PartyAndAccountBalance, PaymentComment, PaymentActivityItem, InvoiceAllocation, PaymentDeductionForm, UnreconcileAllocation, PaymentAfterSaveResult, DocInfo, DocInfoVersion, DocInfoUserInfo, DocInfoAssignment, DocInfoPermissions, ActivityMessageSegment, VersionDoc } from "../types"

export async function allocateAmountToReferences(
  doc: PaymentEntryDocSnapshot,
  args: { paid_amount: number; paid_amount_change: boolean; allocate_payment_amount: boolean }
): Promise<PaymentEntry | null> {
  const body = await postMethodRaw<{ docs?: Array<PaymentEntry | null> }>(
    "run_doc_method",
    {
      method: "allocate_amount_to_references",
      docs: JSON.stringify(doc),
      args: JSON.stringify(args),
    },
    { "x-frappe-doctype": encodeURIComponent("Payment Entry") }
  )
  return body.docs?.[0] ?? null
}

// Persist a Payment Entry but preserve the full save response so callers can
// read `matched_payment_requests` (mirrors ERPNext `after_save`).
export async function savePaymentRaw(
  data: RecordPaymentData,
  name?: string
): Promise<PaymentAfterSaveResult> {
  const isUpdate = !!name
  const opts = isUpdate ? { omitNamingSeries: true, omitAmendedFrom: true } : {}
  const body = await apiClientWithBody<{
    docs?: Array<PaymentEntry | PaymentAfterSaveResult>
    matched_payment_requests?: string[][]
  }>(isUpdate ? `/resource/Payment Entry/${encodeURIComponent(name)}` : "/resource/Payment Entry", {
    method: isUpdate ? "PUT" : "POST",
    body: JSON.stringify(buildPaymentDoc(data, opts)),
  })
  const doc = Array.isArray(body.docs) ? body.docs[0] : (body as unknown as { data?: PaymentEntry }).data
  return {
    name: (doc as PaymentEntry)?.name ?? name ?? "",
    matchedPaymentRequests: body.matched_payment_requests,
  }
}

export async function setMatchedPaymentRequests(
  doc: Record<string, unknown>,
  matchedPaymentRequests: string[][]
): Promise<PaymentEntry | null> {
  const body = await postMethodRaw<{ docs?: Array<PaymentEntry | null> }>(
    "run_doc_method",
    {
      method: "set_matched_payment_requests",
      docs: JSON.stringify(doc),
      args: JSON.stringify({ matched_payment_requests: matchedPaymentRequests }),
    },
    { "x-frappe-doctype": encodeURIComponent("Payment Entry") }
  )
  return body.docs?.[0] ?? null
}

export interface ReferenceDetails {
  due_date?: string
  total_amount: number
  outstanding_amount: number
  exchange_rate?: number
  bill_no?: string
  account_type?: string
  payment_type?: string
  account?: string
}

export interface PaymentEntryDocSnapshot {
  doctype: "Payment Entry"
  name?: string
  modified?: string
  payment_type: string
  party_type: string
  company: string
  party?: string
  paid_amount: number
  received_amount?: number
  references?: Array<{
    reference_doctype?: string
    reference_name?: string
    outstanding_amount?: number
    allocated_amount?: number
    payment_term?: string
    payment_request?: string
  }>
  deductions?: Array<{ amount?: number }>
}

export interface PaymentListFilters {
  page?: number
  pageSize?: number
  start?: number
  pageLength?: number
  status?: string
  paymentType?: string
  partyType?: string
  modeOfPayment?: string
  party?: string
  company?: string
  postingDateFrom?: string
  postingDateTo?: string
  /** General search matching ID/name, party and party name (ERPNext "ID"/"Title" filters). */
  search?: string
  /** Filter by an assigned user id (ERPNext list "Assigned To" click filter, `_assign like %id%`). */
  assignedTo?: string
  /** Exact ID match — ERPNext's detached ID column click filter (`name,=,PAY-…`). */
  name?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

// Frappe splits the list search into a top-level `or_filters` group; nested
// ["OR", ...] arrays inside `filters` are rejected (get_filter treats them as
// a doctype "OR"). buildPaymentFilters mirrors that server-side contract.
export interface PaymentFilterSet {
  filters?: unknown[]
  orFilters?: unknown[]
}

export function buildPaymentFilters(params: PaymentListFilters): PaymentFilterSet | undefined {
  const filters: unknown[] = []
  if (params.status) {
    const docstatus = params.status === "draft" ? 0 : params.status === "submitted" ? 1 : 2
    filters.push(["docstatus", "=", docstatus])
  }
  if (params.paymentType) {
    filters.push(["payment_type", "=", params.paymentType])
  }
  if (params.partyType) {
    filters.push(["party_type", "=", params.partyType])
  }
  if (params.modeOfPayment) {
    filters.push(["mode_of_payment", "=", params.modeOfPayment])
  }
  if (params.company) {
    filters.push(["company", "=", params.company])
  }
  if (params.party) {
    filters.push(["party_name", "like", `%${params.party}%`])
  }
  if (params.assignedTo) {
    filters.push(["_assign", "like", `%${params.assignedTo}%`])
  }
  if (params.name) {
    filters.push(["name", "=", params.name])
  }
  if (params.postingDateFrom) {
    filters.push(["posting_date", ">=", params.postingDateFrom])
  }
  if (params.postingDateTo) {
    filters.push(["posting_date", "<=", params.postingDateTo])
  }

  const orFilters: unknown[] = []
  if (params.search) {
    const like = `%${params.search}%`
    orFilters.push(
      ["name", "like", like],
      ["party", "like", like],
      ["party_name", "like", like]
    )
  }

  if (filters.length === 0 && orFilters.length === 0) return undefined
  return {
    ...(filters.length > 0 ? { filters } : {}),
    ...(orFilters.length > 0 ? { orFilters } : {}),
  }
}

// Plain filters only, for the server-side export. download_template passes
// export_filters straight to frappe.get_list filters, so it cannot contain an
// ["OR", ...] group — drop the list-search clause (ERPNext's Data Export has
// the same limitation).
export function buildExportFilters(params: PaymentListFilters): unknown[] | undefined {
  return buildPaymentFilters(params)?.filters
}

function buildPaymentDoc(
  data: RecordPaymentData,
  opts: { omitNamingSeries?: boolean; omitAmendedFrom?: boolean } = {}
): Record<string, unknown> {
  const safeDate = (v?: string) => (v && DATE_RE.test(v) ? v : undefined)

  const doc: Record<string, unknown> = {
    doctype: "Payment Entry",
    payment_type: data.payment_type,
    party_type: data.party_type || undefined,
    party: data.party || undefined,
    party_name: data.party_name || undefined,
    posting_date: data.posting_date,
    company: data.company,
    mode_of_payment: data.mode_of_payment || undefined,
    paid_from: data.paid_from,
    paid_from_account_currency: data.paid_from_account_currency,
    paid_to: data.paid_to,
    paid_to_account_currency: data.paid_to_account_currency,
    paid_amount: data.paid_amount,
    received_amount: data.received_amount,
    source_exchange_rate: data.source_exchange_rate,
    target_exchange_rate: data.target_exchange_rate,
    base_paid_amount: data.base_paid_amount,
    base_received_amount: data.base_received_amount,
    reference_no: data.reference_no || undefined,
    reference_date: safeDate(data.reference_date),
    clearance_date: safeDate(data.clearance_date),
    custom_remarks: data.custom_remarks || undefined,
    remarks: data.remarks || undefined,
  }

  if (!opts.omitNamingSeries && data.naming_series) doc.naming_series = data.naming_series
  if (data.sales_taxes_and_charges_template) doc.sales_taxes_and_charges_template = data.sales_taxes_and_charges_template
  if (data.purchase_taxes_and_charges_template) doc.purchase_taxes_and_charges_template = data.purchase_taxes_and_charges_template
  if (data.apply_tax_withholding_amount !== undefined) doc.apply_tax_withholding_amount = data.apply_tax_withholding_amount
  if (data.tax_withholding_category) doc.tax_withholding_category = data.tax_withholding_category
  if (data.print_heading) doc.print_heading = data.print_heading
  if (data.is_opening) doc.is_opening = data.is_opening
  if (!opts.omitAmendedFrom && data.amended_from) doc.amended_from = data.amended_from
  if (data.bank_account) doc.bank_account = data.bank_account
  if (data.party_bank_account) doc.party_bank_account = data.party_bank_account
  if (data.contact_person) doc.contact_person = data.contact_person
  if (data.contact_email) doc.contact_email = data.contact_email
  if (data.cost_center) doc.cost_center = data.cost_center
  if (data.project) doc.project = data.project
  if (data.letter_head) doc.letter_head = data.letter_head
  if (data.book_advance_payments_in_separate_party_account !== undefined) {
    doc.book_advance_payments_in_separate_party_account = data.book_advance_payments_in_separate_party_account
  }
  if (data.reconcile_on_advance_payment_date !== undefined) {
    doc.reconcile_on_advance_payment_date = data.reconcile_on_advance_payment_date
  }

  const validRefs = (data.references || []).filter((r) => r.reference_name)
  if (validRefs.length > 0) {
    doc.references = validRefs.map((r) => ({
      reference_doctype: r.reference_doctype,
      reference_name: r.reference_name,
      total_amount: r.total_amount,
      outstanding_amount: r.outstanding_amount,
      allocated_amount: r.allocated_amount,
      due_date: safeDate(r.due_date),
      bill_no: r.bill_no || undefined,
      exchange_rate: r.exchange_rate || undefined,
      exchange_gain_loss: r.exchange_gain_loss || undefined,
      account: r.account || undefined,
      payment_request: r.payment_request || undefined,
    }))
  }

  if (data.deductions && data.deductions.length > 0) {
    doc.deductions = data.deductions
      .filter((d) => d.account && d.amount > 0)
      .map((d) => ({
        account: d.account,
        cost_center: d.cost_center,
        amount: d.amount,
        description: d.description || undefined,
        is_exchange_gain_loss: d.is_exchange_gain_loss ? 1 : undefined,
      }))
  }

  if (data.taxes && data.taxes.length > 0) {
    doc.taxes = data.taxes.map((t) => ({
      charge_type: t.charge_type,
      row_id: t.row_id || undefined,
      account_head: t.account_head,
      description: t.description || undefined,
      rate: t.rate ?? undefined,
      tax_amount: t.tax_amount ?? undefined,
      total: t.total ?? undefined,
      add_deduct_tax: t.add_deduct_tax || "Add",
      included_in_paid_amount: t.included_in_paid_amount ? 1 : undefined,
      cost_center: t.cost_center || undefined,
      project: t.project || undefined,
    }))
  }

  return doc
}

// ─── Timeline building ───────────────────────────────────────────────
// Port of frappe/public/js/frappe/form/footer/version_timeline_content_builder.js
// + form_timeline.js prepare_timeline_contents. Each Version doc emits one (or
// more) combined messages — field changes are comma-joined, docstatus changes
// become "You submitted/cancelled this document".

const FIELD_LABELS: Record<string, string> = {
  docstatus: "Document Status",
  title: "Title",
  party_name: "Party Name",
  party: "Party",
  party_type: "Party Type",
  payment_references: "Payment References",
  posting_date: "Posting Date",
  company: "Company",
  mode_of_payment: "Mode of Payment",
  reference_no: "Reference No",
  reference_date: "Reference Date",
  clearance_date: "Clearance Date",
  remarks: "Remarks",
  custom_remarks: "Custom Remarks",
  status: "Status",
  paid_amount: "Paid Amount",
  received_amount: "Received Amount",
  base_paid_amount: "Base Paid Amount",
  base_received_amount: "Base Received Amount",
  paid_from: "Paid From",
  paid_to: "Paid To",
  paid_from_account_currency: "Paid From Account Currency",
  paid_to_account_currency: "Paid To Account Currency",
  source_exchange_rate: "Source Exchange Rate",
  target_exchange_rate: "Target Exchange Rate",
  total_allocated_amount: "Total Allocated Amount",
  unallocated_amount: "Unallocated Amount",
  difference_amount: "Difference Amount",
  bank_account: "Bank Account",
  party_bank_account: "Party Bank Account",
  contact_person: "Contact Person",
  contact_email: "Contact Email",
  cost_center: "Cost Center",
  project: "Project",
  naming_series: "Naming Series",
  letter_head: "Letter Head",
  print_heading: "Print Heading",
}

export function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  return field
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// ERPNext's comment composer stores content as Quill HTML wrapped in
// <div class="ql-editor read-mode"> (see ControlTextEditor.get_input_value).
// Our composer is a plain textarea, so convert the typed text into the same
// shape before calling frappe.desk.form.utils.add_comment.
function toQuillHtml(text: string): string {
  const escaped = sanitizeHtml(
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
  )
  return `<div class="ql-editor read-mode"><p>${escaped}</p></div>`
}

// Port of version_timeline_content_builder.js format_content_for_timeline():
// html2text → ellipsis(40) → '""' fallback. null renders as the literal "null"
// (matching ERPNext's html2text DOM-parsing behaviour). Rendered bold by the UI.
function formatTimelineValue(value: unknown): string {
  const raw = value == null ? "null" : stripHtml(String(value))
  const truncated = raw.length > 40 ? `${raw.slice(0, 40)}...` : raw
  return truncated || '""'
}

function userDisplayName(owner: string, currentUserId: string | null, userInfo: DocInfoUserInfo): string {
  if (currentUserId && owner === currentUserId) return "You"
  return userInfo[owner]?.fullname || owner
}

function userSegment(owner: string, currentUserId: string | null, userInfo: DocInfoUserInfo): ActivityMessageSegment[] {
  return [{ type: "text", text: userDisplayName(owner, currentUserId, userInfo) }]
}

function userMessage(
  owner: string,
  currentUserId: string | null,
  _userInfo: DocInfoUserInfo,
  self: ActivityMessageSegment[],
  other: ActivityMessageSegment[]
): ActivityMessageSegment[] {
  return currentUserId && owner === currentUserId ? self : other
}

function changedValueParts(parts: Array<{ label: string; oldValue: string; newValue: string }>): ActivityMessageSegment[] {
  const segments: ActivityMessageSegment[] = []
  parts.forEach((p, i) => {
    if (i > 0) segments.push({ type: "text", text: ", " })
    segments.push({ type: "text", text: `${p.label} from ` })
    segments.push({ type: "bold", text: p.oldValue })
    segments.push({ type: "text", text: " to " })
    segments.push({ type: "bold", text: p.newValue })
  })
  return segments
}

function buildVersionMessages(
  version: DocInfoVersion,
  currentUserId: string | null,
  userInfo: DocInfoUserInfo
): ActivityMessageSegment[][] {
  if (!version.data) return []
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(version.data) as Record<string, unknown>
  } catch {
    return []
  }

  const out: ActivityMessageSegment[][] = []

  if (data.comment) {
    out.push([{ type: "text", text: String(data.comment) }])
    return out
  }

  // value changed in parent
  const changed = Array.isArray(data.changed) ? (data.changed as unknown[][]) : []
  const parts: Array<{ label: string; oldValue: string; newValue: string }> = []
  for (const p of changed) {
    if (!Array.isArray(p) || p.length < 3) continue
    const field = String(p[0])
    if (field === "docstatus") {
      if (p[2] === 1 || p[2] === 2) {
        const isSubmit = p[2] === 1
        out.push(
          userMessage(
            version.owner,
            currentUserId,
            userInfo,
            [{ type: "text", text: isSubmit ? "You submitted this document" : "You cancelled this document" }],
            [
              ...userSegment(version.owner, currentUserId, userInfo),
              { type: "text", text: isSubmit ? " submitted this document" : " cancelled this document" },
            ]
          )
        )
      }
    } else if (parts.length < 3) {
      parts.push({
        label: fieldLabel(field),
        oldValue: formatTimelineValue(p[1]),
        newValue: formatTimelineValue(p[2]),
      })
    }
  }
  if (parts.length) {
    const detail = changedValueParts(parts)
    out.push(
      userMessage(
        version.owner,
        currentUserId,
        userInfo,
        [{ type: "text", text: "You changed the value of " }, ...detail],
        [
          ...userSegment(version.owner, currentUserId, userInfo),
          { type: "text", text: " changed the value of " },
          ...detail,
        ]
      )
    )
  }

  // value changed in a table (child table rows)
  const rowChanged = Array.isArray(data.row_changed) ? (data.row_changed as unknown[][]) : []
  const rowParts: Array<{ label: string; oldValue: string; newValue: string }> = []
  for (const row of rowChanged) {
    if (!Array.isArray(row) || row.length < 4) continue
    const rowIdx = Number(row[1]) + 1
    const rowChanges = Array.isArray(row[3]) ? (row[3] as unknown[][]) : []
    for (const p of rowChanges) {
      if (!Array.isArray(p) || p.length < 3) continue
      if (rowParts.length >= 3) break
      rowParts.push({
        label: `${fieldLabel(String(p[0]))} in row #${rowIdx}`,
        oldValue: formatTimelineValue(p[1]),
        newValue: formatTimelineValue(p[2]),
      })
    }
    if (rowParts.length >= 3) break
  }
  if (rowParts.length) {
    const detail = changedValueParts(rowParts)
    out.push(
      userMessage(
        version.owner,
        currentUserId,
        userInfo,
        [{ type: "text", text: "You changed the values for " }, ...detail],
        [
          ...userSegment(version.owner, currentUserId, userInfo),
          { type: "text", text: " changed the values for " },
          ...detail,
        ]
      )
    )
  }

  // rows added / removed
  for (const key of ["added", "removed"] as const) {
    const rows = Array.isArray(data[key]) ? (data[key] as unknown[][]) : []
    if (rows.length === 0) continue
    const counts = new Map<string, number>()
    for (const p of rows) {
      if (!Array.isArray(p)) continue
      const label = fieldLabel(String(p[0]))
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    if (counts.size === 0) continue
    const verb = key === "added" ? "added" : "removed"
    const prep = key === "added" ? "to" : "from"
    const segments: ActivityMessageSegment[] = []
    let first = true
    for (const [tableName, count] of counts) {
      const rowPhrase = count > 1 ? `${count} rows ${prep} ${tableName}` : `1 row ${prep} ${tableName}`
      if (first) {
        segments.push(
          ...userMessage(
            version.owner,
            currentUserId,
            userInfo,
            [{ type: "text", text: `You ${verb} ${rowPhrase}` }],
            [...userSegment(version.owner, currentUserId, userInfo), { type: "text", text: ` ${verb} ${rowPhrase}` }]
          )
        )
        first = false
      } else {
        segments.push({ type: "text", text: `, ${rowPhrase}` })
      }
    }
    out.push(segments)
  }

  return out
}

// Mirrors form_timeline.js prepare_timeline_contents: created + last-edited
// (from the doc) always, then user comments and Version content. Callers decide
// what to hide behind the "Show all activity" toggle.
export function buildTimelineItems(
  doc: PaymentEntry,
  docinfo: DocInfo,
  currentUserId?: string
): PaymentActivityItem[] {
  const currentUser = currentUserId || null
  const userInfo = docinfo.user_info ?? {}
  const items: PaymentActivityItem[] = []
  let counter = 0
  const nextId = () => `timeline-${++counter}`

  if (doc.creation && doc.owner) {
    items.push({
      id: nextId(),
      kind: "created",
      author: doc.owner,
      createdAt: doc.creation,
      message: userMessage(
        doc.owner,
        currentUser,
        userInfo,
        [{ type: "text", text: "You created this" }],
        [...userSegment(doc.owner, currentUser, userInfo), { type: "text", text: " created this" }]
      ),
    })
  }

  if (doc.modified && (doc.modified_by || doc.owner)) {
    const modifier = doc.modified_by || doc.owner || ""
    items.push({
      id: nextId(),
      kind: "modified",
      author: modifier,
      createdAt: doc.modified,
      message: userMessage(
        modifier,
        currentUser,
        userInfo,
        [{ type: "text", text: "You last edited this" }],
        [...userSegment(modifier, currentUser, userInfo), { type: "text", text: " last edited this" }]
      ),
    })
  }

  for (const comment of docinfo.comments ?? []) {
    if (comment.comment_type && comment.comment_type !== "Comment") continue
    items.push({
      id: `comment-${comment.name}`,
      kind: "comment",
      author: comment.owner,
      authorName: userDisplayName(comment.owner, currentUser, userInfo),
      authorAvatarName: userInfo[comment.owner]?.fullname || comment.owner,
      commentName: comment.name,
      createdAt: comment.creation,
      content: comment.content ?? "",
    })
  }

  // Emails (Communication, medium "Email") — rendered as cards interleaved with
  // comments and versions, mirroring frappe's form_timeline communications.
  for (const comm of docinfo.communications ?? []) {
    if (comm.communication_type === "Automated Message") continue
    const sender = comm.sender ?? ""
    const senderName = comm.sender_full_name || userDisplayName(sender, currentUser, userInfo)
    // Frappe serves communication attachments as a JSON string (load.py
    // json.dumps it); form_timeline.js JSON.parses client-side. Accept both.
    const rawAttachments = comm.attachments
    let attachments: Array<{ file_url: string; is_private?: number }> = []
    if (typeof rawAttachments === "string") {
      try {
        const parsed = JSON.parse(rawAttachments)
        if (Array.isArray(parsed)) attachments = parsed
      } catch {
        attachments = []
      }
    } else if (Array.isArray(rawAttachments)) {
      attachments = rawAttachments
    }
    items.push({
      id: `communication-${comm.name}`,
      kind: "email",
      author: sender,
      authorName: senderName,
      authorAvatarName: comm.sender_full_name || sender,
      senderName,
      senderEmail: sender,
      communicationName: comm.name,
      subject: comm.subject,
      recipients: comm.recipients,
      deliveryStatus: comm.delivery_status,
      createdAt: comm.communication_date || comm.creation,
      content: comm.content ?? "",
      attachments: attachments
        .filter((a) => a && typeof a.file_url === "string")
        .map((a) => ({ fileUrl: a.file_url, isPrivate: a.is_private })),
    })
  }

  for (const version of docinfo.versions ?? []) {
    const messages = buildVersionMessages(version, currentUser, userInfo)
    messages.forEach((message, index) => {
      items.push({
        id: `${version.name}-${index}`,
        kind: "version",
        author: version.owner,
        versionName: version.name,
        createdAt: version.creation,
        message,
      })
    })
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export const paymentService = {
  async list(params: PaymentListFilters = {}): Promise<PaymentEntryListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageLength ?? params.pageSize ?? 10
    const limit_start = params.start != null ? params.start : (page - 1) * pageSize
    const built = buildPaymentFilters(params)
    const order_by = params.sortBy
      ? `${params.sortBy} ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
      : "posting_date DESC"

    const [rows, total] = await Promise.all([
      apiClient<PaymentEntry[]>(
        buildListUrl("Payment Entry", {
          fields: LIST_FIELDS,
          filters: built?.filters,
          orFilters: built?.orFilters,
          limit_page_length: pageSize,
          limit_start,
          order_by,
        })
      ),
      getCount("Payment Entry", built?.filters, built?.orFilters),
    ])

    return {
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getById(name: string): Promise<PaymentEntry> {
    return apiClient<PaymentEntry>(`/resource/Payment Entry/${encodeURIComponent(name)}`)
  },

  async isDocumentAmended(name: string): Promise<string | boolean> {
    return postMethod<string | boolean>("frappe.client.is_document_amended", {
      doctype: "Payment Entry",
      docname: name,
    })
  },

  async getPartyDetails(
    company: string,
    partyType: string,
    party: string,
    date: string,
    cost_center?: string
  ): Promise<PartyDetails> {
    const params: Record<string, unknown> = {
      company,
      party_type: partyType,
      party,
      date,
    }
    if (cost_center) params.cost_center = cost_center
    return postMethod<PartyDetails>(
      "erpnext.accounts.doctype.payment_entry.payment_entry.get_party_details",
      params
    )
  },

  async getAccountDetails(account: string, date: string, cost_center?: string): Promise<AccountDetails> {
    const params: Record<string, unknown> = { account, date }
    if (cost_center) params.cost_center = cost_center
    return postMethod<AccountDetails>(
      "erpnext.accounts.doctype.payment_entry.payment_entry.get_account_details",
      params
    )
  },

  async getContactDetails(contact: string): Promise<ContactDetails> {
    return postMethod<ContactDetails>(
      "frappe.contacts.doctype.contact.contact.get_contact_details",
      { contact }
    )
  },

  async getPartyAndAccountBalance(args: {
    company: string
    date: string
    paid_from: string
    paid_to: string
    party_type?: string
    party?: string
    cost_center?: string
  }): Promise<PartyAndAccountBalance> {
    return postMethod<PartyAndAccountBalance>(
      "erpnext.accounts.doctype.payment_entry.payment_entry.get_party_and_account_balance",
      args
    )
  },

  async getBankAccountDetails(bankAccount: string): Promise<BankAccountDetails> {
    return postMethod<BankAccountDetails>(
      "erpnext.accounts.doctype.bank_account.bank_account.get_bank_account_details",
      { bank_account: bankAccount }
    )
  },

async getOutstandingReferences(args: GetOutstandingArgs): Promise<OutstandingReference[]> {
    return apiClient<OutstandingReference[]>(
      `/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_outstanding_reference_documents?` +
      new URLSearchParams({ args: JSON.stringify(args) }).toString()
    )
  },

  // Variant that also surfaces ERPNext `_server_messages` carried on a 200
  // response (e.g. "No outstanding invoices found ..."), which the plain
  // getOutstandingReferences drops.
  async getOutstandingReferencesWithMessages(
    args: GetOutstandingArgs
  ): Promise<{ items: OutstandingReference[]; messages: AppMessage[] }> {
    const body = await apiClientWithBody<{ message?: OutstandingReference[] }>(
      `/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_outstanding_reference_documents?` +
      new URLSearchParams({ args: JSON.stringify(args) }).toString()
    )
    const items = Array.isArray(body.message) ? (body.message as OutstandingReference[]) : []
    return { items, messages: serverMessagesFromBody(body) }
  },

  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    date: string,
    keySuffix?: string,
    options?: { skipDedup?: boolean }
  ): Promise<number> {
    const fetchRate = () =>
      postMethod<number | string>("erpnext.setup.utils.get_exchange_rate", {
        transaction_date: date,
        from_currency: fromCurrency,
        to_currency: toCurrency,
      }).then((result) => Number(result) || 1)

    if (options?.skipDedup) return fetchRate()

    const baseKey = `get_exchange_rate:${fromCurrency}:${toCurrency}:${date}`
    const key = keySuffix ? `${baseKey}:${keySuffix}` : baseKey
    return withDedup(key, 2000, fetchRate)
  },

  async getBankCashAccount(modeOfPayment: string, company: string): Promise<string> {
    const result = await postMethod<{ account: string }>(
      "erpnext.accounts.doctype.sales_invoice.sales_invoice.get_bank_cash_account",
      { mode_of_payment: modeOfPayment, company }
    )
    return result.account
  },

  async getModeOfPaymentAccount(mop: string, company: string): Promise<string | null> {
    try {
      return await this.getBankCashAccount(mop, company)
    } catch {
      return null
    }
  },

  async fetchTaxesAndCharges(
    masterDoctype: string,
    masterName: string
  ): Promise<PaymentEntryTax[]> {
    try {
      const result = await apiClient<Array<Record<string, unknown>>>(
        "/method/erpnext.controllers.accounts_controller.get_taxes_and_charges",
        {
          method: "POST",
          body: JSON.stringify({ master_doctype: masterDoctype, master_name: masterName }),
        }
      )
      return (result || []).map((t) => ({
        charge_type: String(t.charge_type === "On Net Total" ? "On Paid Amount" : t.charge_type || ""),
        account_head: String(t.account_head || ""),
        description: t.description ? String(t.description) : undefined,
        rate: t.rate != null ? Number(t.rate) : undefined,
        tax_amount: t.tax_amount != null ? Number(t.tax_amount) : undefined,
        total: t.total != null ? Number(t.total) : undefined,
        add_deduct_tax: String(t.add_deduct_tax || "Add"),
        included_in_paid_amount: t.included_in_paid_amount ? 1 : 0,
        cost_center: t.cost_center ? String(t.cost_center) : undefined,
        project: t.project ? String(t.project) : undefined,
        currency: t.currency ? String(t.currency) : undefined,
      }))
    } catch {
      throw new Error("Failed to load taxes from template.")
    }
  },

  async getTaxRate(accountHead: string): Promise<{ tax_rate: number; account_name: string }> {
    try {
      return await apiClient<{ tax_rate: number; account_name: string }>(
        "/method/erpnext.controllers.accounts_controller.get_tax_rate?" +
          new URLSearchParams({ account_head: accountHead }).toString()
      )
    } catch {
      return { tax_rate: 0, account_name: "" }
    }
  },

  async getSupplierWithholding(party: string): Promise<string | null> {
    try {
      const result = await apiClient<Record<string, unknown>>(
        "/method/frappe.client.get_value?" +
        new URLSearchParams({
          doctype: "Supplier",
          fieldname: JSON.stringify(["tax_withholding_category"]),
          filters: JSON.stringify({ name: party }),
        }).toString()
      )
      return (result.tax_withholding_category as string) || null
    } catch {
      return null
    }
  },

  async getUnpaidInvoices(filters?: unknown[], partyType?: string): Promise<SalesInvoice[]> {
    const baseFilters: unknown[] = [["docstatus", "=", 1], ["outstanding_amount", ">", 0]]
    const allFilters = filters ? [...baseFilters, ...filters] : baseFilters

    const doctype = partyType === "Supplier" ? "Purchase Invoice" : "Sales Invoice"
    const fields = partyType === "Supplier"
      ? ["name", "supplier as customer", "supplier_name as customer_name", "grand_total", "outstanding_amount", "posting_date", "due_date", "status"]
      : ["name", "customer", "customer_name", "grand_total", "outstanding_amount", "posting_date", "due_date", "status"]

    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify(fields))
    qp.set("filters", JSON.stringify(allFilters))
    qp.set("limit_page_length", "100")
    return apiClient<SalesInvoice[]>(`/resource/${encodeURIComponent(doctype)}?${qp.toString()}`)
  },

  async saveDraft(data: RecordPaymentData): Promise<PaymentEntry> {
    return apiClient<PaymentEntry>("/resource/Payment Entry", {
      method: "POST",
      body: JSON.stringify(buildPaymentDoc(data)),
    })
  },

  async updatePayment(name: string, data: RecordPaymentData): Promise<PaymentEntry> {
    return apiClient<PaymentEntry>(
      `/resource/Payment Entry/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        body: JSON.stringify(buildPaymentDoc(data, { omitNamingSeries: true, omitAmendedFrom: true })),
      }
    )
  },

  async submitPayment(name: string): Promise<PaymentEntry> {
    return apiClient<PaymentEntry>(
      `/resource/Payment Entry/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ docstatus: 1 }) }
    )
  },

  async cancelPayment(name: string): Promise<PaymentEntry> {
    return apiClient<PaymentEntry>(
      `/resource/Payment Entry/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ docstatus: 2 }) }
    )
  },

  async deletePayment(name: string): Promise<void> {
    await apiClient(
      `/resource/Payment Entry/${encodeURIComponent(name)}`,
      { method: "DELETE" }
    )
  },

  // Bulk submit/cancel via frappe.desk.doctype.bulk_update.bulk_update
  // .submit_cancel_or_update_docs (server-side batching: sync <20 docs,
  // enqueue 20-500, throws above 500). Mirrors ERPNext's list bulk actions.
  // `enqueued` is true when the server pushed the batch to the background queue.
  // `messages` carries ERPNext `_server_messages` (e.g. "Invoice already fully
  // paid") even though the server reports HTTP 200 with the failed docnames.
  async bulkSubmit(names: string[]): Promise<{ failed: string[]; enqueued: boolean; messages: AppMessage[] }> {
    const result = await postMethodRaw<{ message?: string[] | null; failed?: string[] } & Record<string, unknown>>(
      "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
      { doctype: "Payment Entry", action: "submit", docnames: JSON.stringify(names) }
    )
    const msg = Array.isArray(result.message) ? result.message : []
    return {
      failed: Array.isArray(result.failed) ? result.failed : msg,
      enqueued: result.message == null,
      messages: serverMessagesFromBody(result),
    }
  },

  async bulkCancel(names: string[]): Promise<{ failed: string[]; enqueued: boolean; messages: AppMessage[] }> {
    const result = await postMethodRaw<{ message?: string[] | null; failed?: string[] } & Record<string, unknown>>(
      "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
      { doctype: "Payment Entry", action: "cancel", docnames: JSON.stringify(names) }
    )
    const msg = Array.isArray(result.message) ? result.message : []
    return {
      failed: Array.isArray(result.failed) ? result.failed : msg,
      enqueued: result.message == null,
      messages: serverMessagesFromBody(result),
    }
  },

  // Bulk delete via frappe.desk.reportview.delete_items. Mirrors the ERPNext
  // list "Delete" action (allows selected docs, falls back to filtered rows).
  async bulkDelete(names: string[]): Promise<{ failed: string[]; messages: AppMessage[] }> {
    const result = await postMethodRaw<{ message?: { undeleted_items?: string[] } | string[] } & Record<string, unknown>>(
      "frappe.desk.reportview.delete_items",
      {
        doctype: "Payment Entry",
        items: JSON.stringify(names),
      }
    )
    const msg = result.message
    if (Array.isArray(msg)) return { failed: msg, messages: serverMessagesFromBody(result) }
    return {
      failed: Array.isArray(msg?.undeleted_items) ? msg.undeleted_items : [],
      messages: serverMessagesFromBody(result),
    }
  },

  // Server-side export via frappe.core.doctype.data_import.data_import
  // .download_template. Returns a Blob for the chosen file type (CSV/Excel),
  // with optional field selection and the currently applied filters.
  async exportRecords(options?: {
    fileType?: "CSV" | "Excel"
    recordMode?: "all" | "by_filter" | "5_records" | "blank_template"
    fields?: Record<string, string[]>
    filters?: unknown[]
  }): Promise<Blob> {
    const body = new URLSearchParams()
    body.set("doctype", "Payment Entry")
    body.set("file_type", options?.fileType ?? "CSV")
    body.set("export_records", options?.recordMode ?? "by_filter")
    // export_fields is required by the exporter; fall back to the default set.
    const fields =
      options?.fields && Object.keys(options.fields).length > 0
        ? options.fields
        : PAYMENT_EXPORT_FIELDS
    body.set("export_fields", JSON.stringify(fields))
    if (options?.filters && options.filters.length > 0) {
      body.set("export_filters", JSON.stringify(options.filters))
    }
    const res = await fetch(
      `${API_CONFIG.baseUrl}/method/frappe.core.doctype.data_import.data_import.download_template`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          ...API_CONFIG.headers,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body,
      }
    )
    if (!res.ok) throw new Error("Failed to export records")
    return res.blob()
  },

  // Bulk print via frappe.utils.print_format.download_multi_pdf. Mirrors the
  // ERPNext list "Print" foreground flow: returns the endpoint URL that the
  // caller opens with window.open so the browser previews the PDF before the
  // user saves it (bulk_operations.js foreground path).
  buildMultiPdfUrl(
    names: string[],
    options: {
      printFormat?: string
      letterhead?: string
      pageSize?: string
      customSize?: { height: number; width: number }
    } = {}
  ): string {
    const pdfOptions: Record<string, string> = {}
    if (options.customSize && options.customSize.height > 0 && options.customSize.width > 0) {
      pdfOptions["page-height"] = String(options.customSize.height)
      pdfOptions["page-width"] = String(options.customSize.width)
    } else {
      pdfOptions["page-size"] = options.pageSize ?? "A4"
    }
    const params = new URLSearchParams()
    params.set("doctype", "Payment Entry")
    params.set("name", JSON.stringify(names))
    params.set("format", options.printFormat ?? "Standard")
    params.set("no_letterhead", options.letterhead ? "0" : "1")
    if (options.letterhead) params.set("letterhead", options.letterhead)
    params.set("options", JSON.stringify(pdfOptions))
    return `${API_CONFIG.baseUrl}/method/frappe.utils.print_format.download_multi_pdf?${params.toString()}`
  },

  // Assignment via frappe.desk.form.assign_to (add_multiple / remove_multiple).
  // `assign_to` must be a JSON array — assign_to.add iterates
  // frappe.parse_json(args["assign_to"]) per assignee (assign_to.py:64).

  // Search assignable users via frappe.desk.search.search_link — the same
  // backend ERPNext's AssignToDialog populates (db.get_link_options -> User,
  // filtered to enabled System Users). Matches name / full name / email.
  async searchAssignableUsers(
    query: string
  ): Promise<{ value: string; label: string; description: string }[]> {
    const results = await apiClient<{ value: string; label?: string; description?: string }[]>(
      `/method/frappe.desk.search.search_link?` +
        new URLSearchParams({
          doctype: "User",
          txt: query,
          page_length: "10",
          filters: JSON.stringify({ user_type: "System User", enabled: 1 }),
        }).toString()
    )
    return (results ?? []).map((u) => ({
      value: u.value,
      label: u.label ?? u.value,
      description: u.description ?? "",
    }))
  },

  async assignTo(names: string[], user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.add_multiple", {
      assign_to: JSON.stringify([user]),
      doctype: "Payment Entry",
      name: JSON.stringify(names),
    })
  },

  async removeAssignment(names: string[]): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.remove_multiple", {
      doctype: "Payment Entry",
      names: JSON.stringify(names),
    })
  },

  // Add tags via frappe.desk.doctype.tag.tag.add_tags (the ERPNext list "Tags"
  // bulk action). `tags` is JSON-stringified; Tag master rows are created
  // server-side. The color is optional and only applied when a tag is created.
  async addTags(names: string[], tags: string | string[], color = ""): Promise<void> {
    const tagLabels = Array.isArray(tags) ? tags : [tags]
    await postMethod("frappe.desk.doctype.tag.tag.add_tags", {
      tags: JSON.stringify(tagLabels),
      dt: "Payment Entry",
      docs: JSON.stringify(names),
      color,
    })
  },

  // ── Single-document assignees (ERPNext form sidebar) ──────────────

  // Resolve assignee user ids → display names for list-row avatars. Mirrors the
  // ids/_assign the list API returns (full names are not included there).
  // Falls back to an empty map when the lookup fails — callers then show the
  // raw id instead of a name.
  async resolveUserNames(
    ids: string[]
  ): Promise<Record<string, { full_name?: string }>> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    if (uniqueIds.length === 0) return {}
    try {
      const rows = await apiClient<Array<{ name: string; full_name?: string }>>(
        `/resource/User?` +
          new URLSearchParams({
            fields: JSON.stringify(["name", "full_name"]),
            filters: JSON.stringify([["name", "in", uniqueIds]]),
            limit_page_length: String(uniqueIds.length),
          }).toString()
      )
      const map: Record<string, { full_name?: string }> = {}
      for (const row of rows ?? []) {
        if (row?.name) map[row.name] = { full_name: row.full_name ?? row.name }
      }
      return map
    } catch {
      return {}
    }
  },

  // Assign a single document to a user: frappe.desk.form.assign_to.add
  // (whitelisted). `assign_to` must be a JSON array.
  async assignUserToDoc(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.add", {
      assign_to: JSON.stringify([user]),
      doctype: "Payment Entry",
      name,
    })
  },

  async unassignUserFromDoc(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.remove", {
      doctype: "Payment Entry",
      name,
      assign_to: user,
    })
  },

  // Mark an assignment as done (only the assignee can complete their own).
  async completeOwnAssignment(name: string, user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.close", {
      doctype: "Payment Entry",
      name,
      assign_to: user,
    })
  },

  // Single-doc tag add/remove (frappe.desk.doctype.tag.tag.add_tag /
  // remove_tag — the form sidebar's TagEditor methods, distinct from the list
  // bulk add_tags).
  async addTagToDoc(name: string, tag: string): Promise<void> {
    await postMethod("frappe.desk.doctype.tag.tag.add_tag", {
      tag,
      dt: "Payment Entry",
      dn: name,
    })
  },

  async removeTagFromDoc(name: string, tag: string): Promise<void> {
    await postMethod("frappe.desk.doctype.tag.tag.remove_tag", {
      tag,
      dt: "Payment Entry",
      dn: name,
    })
  },

  // Tag suggestions (TagEditor augments its input with existing Tag master
  // names): frappe.desk.doctype.tag.tag.get_tags.
  async searchTags(query: string): Promise<string[]> {
    try {
      return (
        (await postMethod<string[] | null>("frappe.desk.doctype.tag.tag.get_tags", {
          doctype: "Payment Entry",
          txt: query,
        })) ?? []
      )
    } catch {
      return []
    }
  },

  async getAccountingLedgerPreview(company: string, name: string): Promise<LedgerPreviewData> {
    return apiClient<LedgerPreviewData>(
      "/method/erpnext.controllers.stock_controller.show_accounting_ledger_preview",
      {
        method: "POST",
        body: JSON.stringify({ company, doctype: "Payment Entry", docname: name }),
      }
    )
  },

  async getLinkedBankTransactions(paymentEntry: string): Promise<string[]> {
    return postMethod<string[]>(
      "erpnext.accounts.doctype.payment_entry.payment_entry.get_linked_bank_transactions",
      { payment_entry: paymentEntry }
    )
  },

  unreconcile: {
    async docHasReferences(doctype: string, docname: string): Promise<number> {
      return postMethod<number>(
        "erpnext.accounts.doctype.unreconcile_payment.unreconcile_payment.doc_has_references",
        { doctype, docname }
      )
    },
    async getLinkedPaymentsForDoc(
      company: string,
      doctype: string,
      docname: string
    ): Promise<UnreconcileAllocation[]> {
      return postMethod<UnreconcileAllocation[]>(
        "erpnext.accounts.doctype.unreconcile_payment.unreconcile_payment.get_linked_payments_for_doc",
        { company, doctype, docname }
      )
    },
    async createUnreconcileDocForSelection(
      selections: Array<{
        company?: string
        voucher_type: string
        voucher_no: string
        against_voucher_type: string
        against_voucher_no: string
      }>
    ): Promise<unknown> {
      return postMethod<unknown>(
        "erpnext.accounts.doctype.unreconcile_payment.unreconcile_payment.create_unreconcile_doc_for_selection",
        { selections }
      )
    },
  },

  async getModeOfPaymentList(): Promise<string[]> {
    try {
      const items = await apiClient<Array<{ name: string }>>(
        `/resource/Mode%20of%20Payment?fields=${encodeURIComponent(JSON.stringify(["name"]))}&limit_page_length=100`
      )
      return items.map((i) => i.name)
    } catch {
      return []
    }
  },

  async getPartyTypes(): Promise<Array<{ name: string; account_type: string | null }>> {
    try {
      return await apiClient<Array<{ name: string; account_type: string | null }>>(
        `/resource/Party%20Type?fields=${encodeURIComponent(JSON.stringify(["name", "account_type"]))}&limit_page_length=0`
      )
    } catch {
      return []
    }
  },

  async getPrintFormats(): Promise<string[]> {
    try {
      const raw = await apiClient<Array<{ name: string }>>(
        `/resource/Print%20Format?filters=${encodeURIComponent(JSON.stringify([["doc_type", "=", "Payment Entry"], ["disabled", "=", 0]]))}&fields=${encodeURIComponent(JSON.stringify(["name"]))}&limit_page_length=100`
      )
      return raw.map((f) => f.name)
    } catch {
      return ["Standard"]
    }
  },

  // Generates the Payment Entry print PDF as a Blob, so the caller can open it
  // in a new tab. Mirrors the ERPNext print action (frappe.utils.print_format
  // .download_pdf) and avoids raw window.open to SPA-fallback URLs.
  async generatePDF(name: string, options?: { printFormat?: string }): Promise<Blob> {
    const params = new URLSearchParams()
    params.set("doctype", "Payment Entry")
    params.set("name", name)
    params.set("format", options?.printFormat || "Standard")
    const res = await fetch(
      `${API_CONFIG.baseUrl}/method/frappe.utils.print_format.download_pdf?${params.toString()}`,
      {
        credentials: "include",
        headers: API_CONFIG.headers,
      }
    )
    if (!res.ok) throw new Error("Failed to generate PDF")
    return res.blob()
  },

  // Resolves a private file (e.g. an email attachment) the way ERPNext does via
  // frappe.utils.file_manager.download_file, returning the bytes as a Blob so we
  // can render/open it without navigating to an SPA fallback route.
  async openAttachment(fileUrl: string): Promise<Blob> {
    const params = new URLSearchParams()
    params.set("file_url", fileUrl)
    const res = await fetch(
      `${API_CONFIG.baseUrl}/method/frappe.utils.file_manager.download_file?${params.toString()}`,
      {
        credentials: "include",
        headers: API_CONFIG.headers,
      }
    )
    if (!res.ok) throw new Error("Failed to open attachment")
    return res.blob()
  },

  // frappe.desk.form.load.get_docinfo — the exact endpoint ERPNext's form
  // footer uses to fetch comments + versions for the timeline.
  async getDocInfo(name: string, doctype = "Payment Entry"): Promise<DocInfo> {
    const body = await apiClientWithBody<{ docinfo?: DocInfo }>(
      `/method/frappe.desk.form.load.get_docinfo?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(name)}`
    )
    return body.docinfo ?? { comments: [], versions: [] }
  },

  // ERPNext-style timeline built from get_docinfo + the doc's own timestamps.
  // Pass the current session user id so messages use "You …" phrasing.
  async getActivity(doc: PaymentEntry, currentUserId?: string): Promise<PaymentActivityItem[]> {
    const docinfo = await this.getDocInfo(doc.name)
    return buildTimelineItems(doc, docinfo, currentUserId)
  },

  // A single Version document — the target of every clickable version message
  // (frappe.utils.get_form_link("Version", name) in version_timeline_content_builder.js).
  async getVersion(name: string): Promise<VersionDoc> {
    return apiClient<VersionDoc>(`/resource/Version/${encodeURIComponent(name)}`)
  },

  async getReferenceDetails(
    reference_doctype: string,
    reference_name: string,
    party_account_currency: string,
    party_type: string,
    party: string
  ): Promise<ReferenceDetails> {
    return postMethod<ReferenceDetails>(
      "erpnext.accounts.doctype.payment_entry.payment_entry.get_reference_details",
      { reference_doctype, reference_name, party_account_currency, party_type, party }
    )
  },

  // ERPNext comment composer uses frappe.desk.form.utils.add_comment (creates a
  // Comment doc that get_docinfo then returns on the next load).
  async addComment(
    name: string,
    content: string,
    commentEmail: string,
    commentBy: string,
    doctype = "Payment Entry"
  ): Promise<PaymentComment> {
    const row = await postMethod<{ name: string; content: string; owner: string; creation: string }>(
      "frappe.desk.form.utils.add_comment",
      {
        reference_doctype: doctype,
        reference_name: name,
        content: toQuillHtml(content),
        comment_email: commentEmail,
        comment_by: commentBy,
      }
    )
    return {
      id: row.name,
      content: row.content,
      author: row.owner,
      createdAt: row.creation,
    }
  },

  // ERPNext timeline edit: frappe.desk.form.utils.update_comment (owner or
  // Administrator only). Content is stored as Quill HTML like add_comment.
  async updateComment(name: string, content: string): Promise<{ name: string }> {
    return postMethod<{ name: string }>("frappe.desk.form.utils.update_comment", {
      name,
      content: toQuillHtml(content),
    })
  },

  // ERPNext timeline delete: frappe.client.delete on the Comment doc. Deletes
  // are restricted to the owner / System Manager on the server.
  async deleteComment(name: string): Promise<{ message: string }> {
    return postMethod<{ message: string }>("frappe.client.delete", {
      doctype: "Comment",
      name,
    })
  },

  async sendEmail(name: string, data: {
    recipients: string
    subject: string
    content: string
    printFormat?: string
  }): Promise<{ name: string }> {
    return apiClient<{ name: string }>("/method/frappe.core.doctype.communication.email.make", {
      method: "POST",
      body: JSON.stringify({
        doctype: "Payment Entry",
        name,
        recipients: data.recipients,
        subject: data.subject,
        content: data.content,
        communication_medium: "Email",
        send_email: 1,
        print_format: data.printFormat || "Standard",
      }),
    })
  },
}

export type { SalesInvoice } from "@/modules/invoices/services"
