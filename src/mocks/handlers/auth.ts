import { http, HttpResponse, delay } from "msw"
import usersData from "../data/auth.json"

const users = usersData.users

export const authHandlers = [
  http.post("/api/auth/login", async ({ request }) => {
    await delay(600)

    const body = (await request.json()) as {
      email: string
      password: string
    }

    const user = users.find(
      (u) => u.email === body.email && u.password === body.password
    )

    if (!user) {
      return HttpResponse.json(
        {
          data: null,
          error: { message: "Invalid email or password." },
        },
        { status: 401 }
      )
    }

    return HttpResponse.json({
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
        token: "mock-jwt-token-blesserp",
      },
      error: null,
    })
  }),

  http.post("/api/auth/logout", async () => {
    await delay(200)
    return HttpResponse.json({ data: null, error: null })
  }),
]
