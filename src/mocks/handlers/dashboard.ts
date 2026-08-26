import { http, HttpResponse, delay } from "msw"
import dashboardData from "../data/dashboard.json"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function withLabels(chart: { date: string; value: number }[]) {
  return chart.map((d) => {
    const [, m, day] = d.date.split("-").map(Number)
    return { ...d, label: `${day} ${MONTHS[m - 1]}` }
  })
}

export const dashboardHandlers = [
  http.get("/api/dashboard", async ({ request }) => {
    const url = new URL(request.url)
    const startDate = url.searchParams.get("startDate")
    const endDate = url.searchParams.get("endDate")

    await delay(400)

    let data = { ...dashboardData }

    let salesChart = data.salesChart
    if (startDate && endDate) {
      salesChart = salesChart.filter((d) => {
        const dStr = d.date
        return dStr >= startDate.slice(5) && dStr <= endDate.slice(5)
      })
    }
    data = { ...data, salesChart: withLabels(salesChart) }

    return HttpResponse.json({
      data,
      error: null,
    })
  }),
]
