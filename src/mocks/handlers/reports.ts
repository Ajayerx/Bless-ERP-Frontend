import { http, HttpResponse, delay } from "msw"
import reportsData from "../data/reports.json"
import { generateGeneralLedger } from "../data/general-ledger"
import { generateSalesRegister, generatePurchaseRegister } from "../data/registers"

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

  http.post("/api/method/frappe.desk.query_report.run", async ({ request }) => {
    await delay(250)
    const form = await request.formData()
    const filtersRaw = String(form.get("filters") ?? "{}")
    let filters: Record<string, unknown> = {}
    try {
      filters = JSON.parse(filtersRaw)
    } catch {
      filters = {}
    }

    const reportName = String(form.get("report_name") ?? "")
    if (reportName === "Sales Register") {
      return HttpResponse.json({
        message: generateSalesRegister(filters as never),
        error: null,
      })
    }
    if (reportName === "Purchase Register") {
      return HttpResponse.json({
        message: generatePurchaseRegister(filters as never),
        error: null,
      })
    }

    const gl = generateGeneralLedger(filters)

    return HttpResponse.json({
      message: { columns: gl.columns, result: gl.result },
      error: null,
    })
  }),
]
