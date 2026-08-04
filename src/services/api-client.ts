import { API_CONFIG } from "../config/api.config"

export class ApiError extends Error {
  public status: number
  public rawMessage: string

  constructor(status: number, message: string, rawMessage?: string) {
    super(message)
    this.status = status
    this.rawMessage = rawMessage ?? message
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
// is a JSON-encoded array of JSON-encoded strings (sometimes double-encoded).
// Falling back to `body.message` alone misses almost all validation errors.
function extractServerMessages(raw: unknown): string[] {
  if (typeof raw !== "string") return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.map((item) => {
      if (typeof item !== "string") return String(item)
      try {
        const parsed = JSON.parse(item)
        if (parsed && typeof parsed === "object" && "message" in parsed) {
          return String(parsed.message)
        }
        return item
      } catch {
        return item
      }
    })
  } catch {
    return []
  }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim()
}

export function parseErrorMessage(body: any, fallback = "Something went wrong"): string {
  const serverMessages = extractServerMessages(body?._server_messages)
  if (serverMessages.length > 0) return stripHtml(serverMessages.join(" "))
  if (typeof body?._error_message === "string") return stripHtml(body._error_message)
  if (typeof body?.message === "string") return stripHtml(body.message)
  if (typeof body?.exception === "string") return stripHtml(body.exception)
  return fallback
}

export function parseRawErrorMessage(body: any, fallback = "Something went wrong"): string {
  const serverMessages = extractServerMessages(body?._server_messages)
  if (serverMessages.length > 0) return serverMessages.join(" ")
  if (typeof body?._error_message === "string") return body._error_message
  if (typeof body?.message === "string") return body.message
  if (typeof body?.exception === "string") return body.exception
  return fallback
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
    throw new ApiError(res.status, parseErrorMessage(body), parseRawErrorMessage(body))
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