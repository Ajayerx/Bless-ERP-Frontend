import { http, HttpResponse, delay } from "msw"
import settingsData from "../data/settings.json"

export const settingsHandlers = [
  http.get("/api/settings", async () => {
    await delay(200)
    return HttpResponse.json({
      data: settingsData,
      error: null,
    })
  }),
]
