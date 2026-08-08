import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(n)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatDateUser(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n)
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
