import { http, HttpResponse, delay } from "msw"
import invoicesData from "../data/invoices.json"

export const reportHandlers = [
  http.get("/api/reports/tax-summary", async () => {
    await delay(400)

    const invoices = invoicesData.filter(
      (inv) => inv.status !== "cancelled" && inv.status !== "draft"
    )

    const totalSales = invoices.reduce((sum, inv) => sum + inv.subtotal, 0)
    const totalGst = invoices.reduce((sum, inv) => sum + inv.gst, 0)
    const totalQst = invoices.reduce((sum, inv) => sum + inv.qst, 0)

    const breakdown = invoices
      .map((inv) => ({
        invoiceNumber: inv.number,
        customerName: inv.customerName,
        issueDate: inv.issueDate,
        subtotal: inv.subtotal,
        gst: inv.gst,
        qst: inv.qst,
        total: inv.total,
      }))
      .sort(
        (a, b) =>
          new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
      )

    return HttpResponse.json({
      data: {
        period: "Q2 2026 (Apr - Jun)",
        totalSales: Math.round(totalSales * 100) / 100,
        totalGst: Math.round(totalGst * 100) / 100,
        totalQst: Math.round(totalQst * 100) / 100,
        totalTax: Math.round((totalGst + totalQst) * 100) / 100,
        breakdown,
      },
      error: null,
    })
  }),
]
