import { API_CONFIG } from "@/config/api.config"

/**
 * Opens the shared list-page bulk-print flow (mirrors ERPNext's
 * bulk_operations foreground/background print paths).
 *
 * - Normal print: opens `foregroundUrl` (frappe.utils.print_format.
 *   download_multi_pdf) in a new tab so the browser previews the merged PDF.
 * - Background print (>25 docs): first hits the asynchronous endpoint
 *   (download_multi_pdf_async). On success we open the returned file link (or
 *   the async URL itself when the server returns a bare task). If the backend
 *   predates that method (404/405 or a frappe exception body), we fall back to
 *   the foreground URL and notify via `onBackgroundFallback`.
 */
export async function openMultiPdfPrint(opts: {
  foregroundUrl: string
  backgroundUrl?: string
  onBlocked?: () => void
  onBackgroundFallback?: () => void
}): Promise<void> {
  const { foregroundUrl, backgroundUrl, onBlocked, onBackgroundFallback } = opts

  if (backgroundUrl) {
    try {
      const res = await fetch(backgroundUrl, {
        credentials: "include",
        headers: { ...API_CONFIG.headers, Accept: "application/json" },
      })
      const json = res.ok ? await res.json().catch(() => null) : null
      const unsupported =
        !res.ok || !json || Boolean(json.exc) || Boolean(json._server_messages)
      if (!unsupported) {
        const target = pickFileLink(json.message) ?? backgroundUrl
        const win = window.open(target, "_blank")
        if (!win) onBlocked?.()
        return
      }
    } catch {
      // fall through to the foreground URL below
    }
    onBackgroundFallback?.()
  }

  const win = window.open(foregroundUrl, "_blank")
  if (!win) onBlocked?.()
}

function pickFileLink(message: unknown): string | null {
  if (message && typeof message === "object") {
    for (const key of ["full_url", "file_url", "document_url", "href", "link"]) {
      const value = (message as Record<string, unknown>)[key]
      if (typeof value === "string" && value) return value
    }
  }
  if (typeof message === "string" && /^(https?:)?\//.test(message)) return message
  return null
}