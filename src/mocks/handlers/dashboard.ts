import { http, HttpResponse, delay } from "msw"
import dashboardData from "../data/dashboard.json"

export const dashboardHandlers = [
  http.get("/api/dashboard", async () => {
    await delay(400)
    return HttpResponse.json({
      data: dashboardData,
      error: null,
    })
  }),
]
