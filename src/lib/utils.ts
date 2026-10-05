import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Client-side id for unsaved child rows, toast handles and draft documents.
// `crypto.randomUUID` is only exposed in a Secure Context (https, or
// http://localhost), so it is simply absent when the dev server is reached
// over the plain-HTTP LAN address and every call site throws a TypeError —
// which is why "Add Customer" appeared to fail while the document itself had
// already been created. Prefer randomUUID when it exists, fall back to an RFC
// 4122 v4 built from crypto.getRandomValues (available on insecure contexts
// too), and only then to Math.random.
export function generateId(): string {
  const webCrypto = globalThis.crypto

  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }

  // RFC 4122 section 4.4: pin the version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex: string[] = []
  for (let i = 0; i < bytes.length; i++) hex.push(bytes[i].toString(16).padStart(2, "0"))

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-")
}

// Local calendar date as YYYY-MM-DD, optionally offset by whole days.
//
// Never use `new Date().toISOString().slice(0, 10)` for a Frappe Date field:
// toISOString() converts to UTC, so every zone west of UTC (e.g.
// America/Toronto, UTC-4/5) reports *tomorrow* for any local time after
// ~20:00. Building the string from local getFullYear/getMonth/getDate keeps a
// "today"/"due in N days" default on the user's calendar day.
export function todayISO(offsetDays = 0): string {
  const d = new Date()
  if (offsetDays) d.setDate(d.getDate() + offsetDays)
  return localDateISO(d)
}

/**
 * Local calendar date of an arbitrary Date as YYYY-MM-DD.
 *
 * Same rationale as `todayISO`: reading UTC via toISOString() shifts the day for
 * anyone west of UTC. Use this whenever a `Date` instance has to become a
 * Frappe Date field, including dates derived from `new Date("YYYY-MM-DD")` —
 * that constructor parses as UTC midnight, so in UTC-5 it is still the previous
 * local day.
 */
export function localDateISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function formatCurrency(n: number, currency = "CAD"): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n)
}

// Frappe sends Date fields as a bare calendar date ("2026-09-23") and Datetime
// fields with a time component ("2026-09-23 10:30:00.123456"). The ES spec
// parses a bare YYYY-MM-DD as UTC midnight, so `new Date(iso)` followed by a
// local-time format renders the *previous* day for every zone west of UTC
// (America/Toronto among them). An exact YYYY-MM-DD match therefore has to be
// formatted straight from its parts; real datetimes keep going through the Date
// object because they do carry an instant.
const CALENDAR_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export interface CalendarDate {
  year: number
  month: number
  day: number
}

export function parseCalendarDate(value: string | null | undefined): CalendarDate | null {
  const match = CALENDAR_DATE_RE.exec((value ?? "").trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

export function formatDate(iso: string): string {
  if (!iso) return ""
  const calendar = parseCalendarDate(iso)
  if (calendar) {
    return `${MONTH_ABBREVIATIONS[calendar.month - 1]} ${calendar.day}, ${calendar.year}`
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatDateUser(iso: string): string {
  if (!iso) return ""
  const calendar = parseCalendarDate(iso)
  if (calendar) {
    const dd = String(calendar.day).padStart(2, "0")
    const mm = String(calendar.month).padStart(2, "0")
    return `${dd}-${mm}-${calendar.year}`
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

export function formatDateDDMMYYYY(iso: string): string {
  if (!iso) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return formatDateUser(iso)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n)
}

export function formatFixed(n: number, precision: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(n)
}

// ERPNext-style editable Currency/Float input helpers. Currency fields display
// grouped integers with fixed decimals (formatFixed above); Float fields keep
// up to `precision` fractional digits with no forced trailing zeros, and
// parseAmountInput strips the grouping separators back to a number.
export function formatFloatInput(n: number, precision = 9): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: precision,
  }).format(n)
}

export function parseAmountInput(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim()
  return cleaned === "" ? 0 : parseFloat(cleaned) || 0
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Port of frappe/public/js/frappe/utils/pretty_date.js (long format) — used by
// the form timeline so relative times match ERPNext exactly ("1 minute ago",
// "1 hour ago", "yesterday", "3 days ago", ...).
export function prettyDate(iso: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.floor((today.getTime() - eventDay.getTime()) / 86400000)

  if (Number.isNaN(dayDiff) || dayDiff < 0) return ""

  if (dayDiff === 0) {
    if (diff < 60) return "just now"
    if (diff < 120) return "1 minute ago"
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
    if (diff < 7200) return "1 hour ago"
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  }
  if (dayDiff === 1) return "yesterday"
  if (dayDiff < 7) return `${dayDiff} days ago`
  if (dayDiff < 14) return "1 week ago"
  if (dayDiff < 31) return `${Math.floor(dayDiff / 7)} weeks ago`
  if (dayDiff < 62) return "1 month ago"
  if (dayDiff < 365) return `${Math.floor(dayDiff / 30)} months ago`
  if (dayDiff < 730) return "1 year ago"
  return `${Math.floor(dayDiff / 365)} years ago`
}

const ERPNEXT_DOCTYPE_ROUTES: Record<string, string> = {
  customer: "/customers",
  contact: "/contacts",
  "sales-invoice": "/invoices",
  "purchase-invoice": "/invoices",
  "payment-entry": "/payments",
  "sales-order": "/orders",
  address: "/customers",
  item: "/products",
  warehouse: "/inventory/warehouses",
  "stock-entry": "/inventory/transfers",
  "stock-reconciliation": "/inventory/counts",
}

// Strip HTML tags and decode common entities to plain text (used to prefill
// the comment edit box with the stored Quill HTML content).
export function htmlToText(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// Sanitize HTML before it is injected via dangerouslySetInnerHTML. Comment
// bodies from ERPNext are Quill HTML (e.g. wrapped in <div class="ql-editor
// read-mode">), so strip anything that could execute scripts and leave the
// safe formatting tags (p, br, strong, em, ul, ol, li, a, blockquote, code).
export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  for (const tag of ["script", "style", "iframe", "object", "embed", "link", "meta"]) {
    doc.querySelectorAll(tag).forEach((el) => el.remove())
  }
  doc.querySelectorAll("[onerror],[onclick],[onload],[onmouseover],[onchange],[onsubmit],[oninput]").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name)
    }
  })
  doc.querySelectorAll("[href],[src]").forEach((el) => {
    const attr = el.hasAttribute("href") ? "href" : "src"
    const value = el.getAttribute(attr) || ""
    if (/^\s*javascript:/i.test(value)) el.setAttribute(attr, "#")
    if (/^\s*data:/i.test(value) && !/^data:image\//i.test(value)) el.setAttribute(attr, "#")
  })
  return doc.body.innerHTML
}

export function rewriteErpNextLinks(html: string): string {
  return html.replace(
    /href="([^"]*?\/app\/([^/]+)\/([^"]+))"/g,
    (_, _fullUrl: string, doctype: string, encodedName: string) => {
      const route = ERPNEXT_DOCTYPE_ROUTES[doctype]
      if (!route) return `href="#"`
      const name = decodeURIComponent(encodedName)
      return `href="${route}/${encodeURIComponent(name)}"`
    }
  )
}
