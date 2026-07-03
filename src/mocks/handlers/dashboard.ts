import { http, HttpResponse, delay } from "msw"
import dashboardData from "../data/dashboard.json"

export const dashboardHandlers = [
  http.get("/api/dashboard", async ({ request }) => {
    const url = new URL(request.url)
    const startDate = url.searchParams.get("startDate")
    const endDate = url.searchParams.get("endDate")

    await delay(400)

    let data = { ...dashboardData }

    if (startDate && endDate) {
      data = {
        ...data,
        salesChart: data.salesChart.filter((d) => {
          const dStr = d.date
          return dStr >= startDate.slice(5) && dStr <= endDate.slice(5)
        }),
      }
    }

    return HttpResponse.json({
      data,
      error: null,
    })
  }),
]
