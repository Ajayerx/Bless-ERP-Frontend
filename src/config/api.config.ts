// In dev, Vite's proxy (see vite.config.ts) forwards "/api" to the Frappe
// backend server-side, so the browser only ever talks to itself (same
// origin) — cookies, CORS, and CSRF all just work without any special
// handling.
//
// In production, the deployed frontend (blesserp.softgoway.com) and the
// Frappe backend (blesserp.com) are different root domains, so the browser
// makes a genuine cross-origin request. This requires the backend to:
//   1. Allow CORS from this exact origin (site_config.json: "allow_cors")
//   2. Issue its session cookie with SameSite=None; Secure
// Without both of those on the backend, this will fail with a CORS error
// or a lost session even though the URL below is correct.
//
// LOCAL TESTING ONLY: set VITE_LOCAL_CROSS_ORIGIN_TEST=true in .env.local
// (gitignored) to bypass Vite's proxy and call the bench directly through a
// local HTTPS front (Caddy `tls internal` on blesserp.local) — a genuine
// cross-origin request, so cookie/CORS/CSRF behavior matches production.
// The `!isProd` guard makes this impossible in a production build, where
// `import.meta.env.PROD` is statically true and this branch is dead code.
const isProd = import.meta.env.PROD
const localCrossOriginTest = import.meta.env.VITE_LOCAL_CROSS_ORIGIN_TEST === "true"

function resolveBaseUrl(): string {
  if (isProd) return "https://blesserp.com/api"
  if (localCrossOriginTest) return "https://blesserp.local/api"
  return "/api"
}

export const API_CONFIG = {
  baseUrl: resolveBaseUrl(),
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
}