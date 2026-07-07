import { http, HttpResponse, delay } from "msw"

function setCookies(headers: Headers): void {
  headers.append("Set-Cookie", "user_id=admin@blesserp.com; Path=/; SameSite=Lax")
  headers.append("Set-Cookie", "csrf_token=mock-csrf-token-blesserp; Path=/; SameSite=Lax")
}

export const frappeAuthHandlers = [
  // Frappe REST: /api/method/login
  http.post("/api/method/login", async ({ request }) => {
    await delay(400)

    const body = (await request.json()) as { usr?: string; pwd?: string }

    if (!body.usr || !body.pwd) {
      return HttpResponse.json(
        { message: "Missing login credentials", exc_type: "AuthenticationError" },
        { status: 401 },
      )
    }

    const headers = new Headers({ "Content-Type": "application/json" })
    setCookies(headers)

    return new HttpResponse(
      JSON.stringify({
        message: "Logged In",
        home_page: "/app",
        full_name: "BlessERP Admin",
      }),
      { status: 200, headers },
    )
  }),

  // Frappe REST: /api/method/logout
  http.post("/api/method/logout", async () => {
    await delay(200)
    return HttpResponse.json({ message: "Logged Out" })
  }),
]
