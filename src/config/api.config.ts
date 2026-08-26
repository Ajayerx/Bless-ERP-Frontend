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
const isProd = import.meta.env.PROD

export const API_CONFIG = {
  baseUrl: isProd ? "https://blesserp.com/api" : "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
}