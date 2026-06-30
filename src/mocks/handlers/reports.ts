import { http, HttpResponse, delay } from "msw"
import reportsData from "../data/reports.json"

export const reportHandlers = [
  http.get("/api/reports/tax-summary", async () => {
    await delay(400)
    return HttpResponse.json({ data: reportsData.taxSummary, error: null })
  }),

  http.get("/api/reports/sales", async () => {
    await delay(400)
    return HttpResponse.json({ data: reportsData.salesReport, error: null })
  }),

  http.get("/api/reports/ar", async () => {
    await delay(400)
    return HttpResponse.json({ data: reportsData.arReport, error: null })
  }),

  http.get("/api/reports/inventory", async () => {
    await delay(400)
    return HttpResponse.json({ data: reportsData.inventoryReport, error: null })
  }),

  http.get("/api/reports/profit-loss", async () => {
    await delay(400)
    return HttpResponse.json({ data: reportsData.profitLoss, error: null })
  }),

  http.get("/api/reports/balance-sheet", async () => {
    await delay(400)
    return HttpResponse.json({ data: reportsData.balanceSheet, error: null })
  }),
]
