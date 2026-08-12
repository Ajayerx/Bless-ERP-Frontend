import { API_CONFIG } from "../config/api.config"

export interface AppMessage {
  title?: string
  message: string
  indicator?: string
}

export class ApiError extends Error {
  public status: number
  public rawMessage: string
  public serverMessage: AppMessage | null

  constructor(status: number, message: string, rawMessage?: string, serverMessage?: AppMessage | null) {
    super(message)
    this.status = status
    this.rawMessage = rawMessage ?? message
    this.serverMessage = serverMessage ?? null
    this.name = "ApiError"
  }
}

// --- CSRF token -------------------------------------------------------
// Frappe sets a "csrf_token" cookie on login; every non‑GET request must
// echo its value in the X-Frappe-CSRF-Token header, or the server returns 403.
function getCsrfToken(): string | undefined {
  const match = document.cookie.match(/\bcsrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

// --- Company header ---------------------------------------------------
// ERPNext multi-company: set X-Frappe-Company to filter data by company.
// CompanyContext sets this on mount / company switch.
let activeCompany: string | null = null

export function setActiveCompany(company: string | null) {
  activeCompany = company
}

export function getActiveCompany(): string | null {
  return activeCompany
}

// --- 401/403 handling -------------------------------------------------
// AuthContext registers a callback here on mount, so this file never has
// to import AuthContext directly (avoids a circular import: AuthContext
// -> authService -> apiClient -> AuthContext).
//
// A simple guard prevents re‑entrant calls (e.g. onUnauthorized itself
// triggering another 401/403 from the session‑verification request).
type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null
let unauthorizing = false

export function registerUnauthorizedHandler(fn: UnauthorizedHandler) {
  onUnauthorized = fn
}

// --- ERPNext error message unwrapping ----------------------------------
// ERPNext puts the real, human-readable error in `_server_messages`, which
// is a JSON-encoded array of JSON-encoded objects (sometimes double-encoded),
// each like { message, title, indicator, raise_exception }. We surface both
// the plain text (for inline contexts/regex) and the structured shape (title
// + indicator) so the UI can render an ERPNext-style "Message" dialog.
function parseServerMessageItem(item: unknown): AppMessage {
  let data = item
  if (typeof item === "string") {
    try {
      data = JSON.parse(item)
    } catch {
      data = item
    }
  }
  if (data && typeof data === "object" && "message" in (data as Record<string, unknown>)) {
    const record = data as Record<string, unknown>
    return {
      title: typeof record.title === "string" ? record.title : undefined,
      message: String(record.message),
      indicator: typeof record.indicator === "string" ? record.indicator : undefined,
    }
  }
  if (typeof data === "string") return { message: data }
  return { message: String(data) }
}

export function extractServerMessages(raw: unknown): AppMessage[] {
  if (typeof raw !== "string") return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.map(parseServerMessageItem).filter((m) => m.message.trim().length > 0)
}

const DEFAULT_APP_MESSAGE: AppMessage = { message: "Something went wrong" }

// ERPNext puts a "red/orange/green/blue" indicator string on the message.
// Map ERPNext indicators onto our semantic tone for the message dialog.
export type AppMessageTone = "error" | "warning" | "success" | "info"

export function messageTone(indicator?: string): AppMessageTone {
  const normalized = (indicator ?? "").toLowerCase().replace(/[^a-z]+/gi, " ").trim()
  if (/red/i.test(normalized)) return "error"
  if (/orange|yellow/i.test(normalized)) return "warning"
  if (/green/i.test(normalized)) return "success"
  return "info"
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim()
}

// Server messages carried on a *successful* (200) response. ERPNext puts
// `frappe.msgprint` output into `_server_messages` even when `message` is a
// normal payload, and the UI should surface them (e.g. "No outstanding
// invoices found ..."). See UserForm/Get Outstanding flow.
export function serverMessagesFromBody(body: unknown): AppMessage[] {
  if (body && typeof body === "object") {
    return extractServerMessages((body as Record<string, unknown>)?._server_messages)
  }
  return []
}

export function parseErrorMessage(body: any, fallback = "Something went wrong"): string {
  const serverMessages = extractServerMessages(body?._server_messages)
  if (serverMessages.length > 0) return stripHtml(serverMessages.map((m) => m.message).join(" "))
  if (typeof body?._error_message === "string") return stripHtml(body._error_message)
  if (typeof body?.message === "string") return stripHtml(body.message)
  if (typeof body?.exception === "string") return stripHtml(body.exception)
  return fallback
}

export function parseRawErrorMessage(body: any, fallback = "Something went wrong"): string {
  const serverMessages = extractServerMessages(body?._server_messages)
  if (serverMessages.length > 0) return serverMessages.map((m) => m.message).join(" ")
  if (typeof body?._error_message === "string") return body._error_message
  if (typeof body?.message === "string") return body.message
  if (typeof body?.exception === "string") return body.exception
  return fallback
}

// Structured variant of parseErrorMessage: returns the first ERPNext server
// message as { title, message, indicator } so components can show a modal.
export function firstServerMessage(body: any, fallback?: string): AppMessage | null {
  const messages = extractServerMessages(body?._server_messages)
  if (messages.length > 0) return messages[0]
  if (typeof body?._error_message === "string") return { message: body._error_message }
  if (typeof body?.message === "string") return { message: String(body.message) }
  if (typeof body?.exception === "string") return { message: String(body.exception) }
  return fallback ? { message: fallback } : DEFAULT_APP_MESSAGE
}

// --- Safe JSON parsing --------------------------------------------------
// Guards against ERPNext/nginx ever returning HTML (a crashed bench, a
// 502 page) instead of JSON, which would otherwise throw a confusing
// "Unexpected token '<'" error.
async function safeParseJson(res: Response): Promise<any> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(res.status, "Server returned an unexpected response. Please try again.")
  }
}

async function fetchJson(endpoint: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout)

  let res: Response
  try {
    const method = (options.method ?? "GET").toUpperCase()
    const csrf = method !== "GET" ? getCsrfToken() : undefined
    res = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
      ...options,
      credentials: "include",
      signal: controller.signal,
      headers: {
        ...API_CONFIG.headers,
        ...(csrf ? { "X-Frappe-CSRF-Token": csrf } : {}),
        ...(activeCompany ? { "X-Frappe-Company": activeCompany } : {}),
        ...(options.headers as Record<string, string>),
      },
    })
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ApiError(0, "Request timed out. Please check your connection.")
    }
    throw new ApiError(0, "Network error. Is the ERPNext server reachable?")
  } finally {
    clearTimeout(timeoutId)
  }

  const body = await safeParseJson(res)

  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && !unauthorizing) {
      unauthorizing = true
      try {
        onUnauthorized?.()
      } finally {
        unauthorizing = false
      }
    }
    throw new ApiError(res.status, parseErrorMessage(body), parseRawErrorMessage(body), firstServerMessage(body))
  }

  return body
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const body = await fetchJson(endpoint, options)
  return (body.data ?? body.message) as T
}

export async function apiClientWithBody<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data?: unknown; message: unknown; docs?: unknown[] } & T> {
  return fetchJson(endpoint, options)
}

// --- ERPNext frappe.call-style form POST --------------------------------
// Mirrors the exact bytes ERPNext's own browser sends for "selection"
// calls (validate_link, get_party_details, get_loyalty_programs, search_link,
// get_value, get_default_taxes_and_charges):
//  - application/x-www-form-urlencoded body built from ordered [key, value]
//    pairs (array/object args are pre-JSON-encoded by the caller)
//  - X-Frappe-CMD = the method path
//  - X-Frappe-Doctype only when a doctype argument is present (frappe sets
//    it from args.doctype)
//  - X-Requested-With: XMLHttpRequest
//  - X-Frappe-CSRF-Token echoed from the cookie (non-GET)
//  - deliberately NO X-Frappe-Company (ERPNext does not send it)
async function fetchForm(endpoint: string, fields: Array<[string, string]>, doctype?: string): Promise<any> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout)

  const body = new URLSearchParams(fields).toString()
  const csrf = getCsrfToken()

  let res: Response
  try {
    res = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Frappe-CMD": endpoint,
        ...(doctype ? { "X-Frappe-Doctype": doctype } : {}),
        "X-Requested-With": "XMLHttpRequest",
        ...(csrf ? { "X-Frappe-CSRF-Token": csrf } : {}),
      },
      body,
    })
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ApiError(0, "Request timed out. Please check your connection.")
    }
    throw new ApiError(0, "Network error. Is the ERPNext server reachable?")
  } finally {
    clearTimeout(timeoutId)
  }

  const bodyJson = await safeParseJson(res)

  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && !unauthorizing) {
      unauthorizing = true
      try {
        onUnauthorized?.()
      } finally {
        unauthorizing = false
      }
    }
    throw new ApiError(res.status, parseErrorMessage(bodyJson), parseRawErrorMessage(bodyJson), firstServerMessage(bodyJson))
  }

  return bodyJson
}

export async function apiFormCall<T>(
  cmd: string,
  fields: Array<[string, string]>,
  opts?: { doctype?: string }
): Promise<T> {
  const body = await fetchForm(cmd, fields, opts?.doctype)
  return (body.data ?? body.message) as T
}