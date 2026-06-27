import { http, HttpResponse, delay } from "msw"
import invoicesData from "../data/invoices.json"
import productsData from "../data/products.json"

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
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())

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

  http.get("/api/reports/sales-summary", async () => {
    await delay(350)
    const invoices = invoicesData.filter((inv) => inv.status !== "cancelled")
    const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0)
    const paidTotal = invoices.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + inv.total, 0)
    const sentTotal = invoices.filter((inv) => inv.status === "sent").reduce((sum, inv) => sum + inv.total, 0)
    const overdueTotal = invoices.filter((inv) => inv.status === "overdue").reduce((sum, inv) => sum + inv.total, 0)
    const recentInvoices = [...invoices]
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
      .slice(0, 10)
      .map((inv) => ({
        number: inv.number,
        customerName: inv.customerName,
        total: inv.total,
        status: inv.status,
        issueDate: inv.issueDate,
      }))

    return HttpResponse.json({
      data: {
        totalSales: Math.round(totalSales * 100) / 100,
        totalInvoices: invoices.length,
        avgInvoiceValue: Math.round((totalSales / invoices.length) * 100) / 100,
        paidTotal: Math.round(paidTotal * 100) / 100,
        sentTotal: Math.round(sentTotal * 100) / 100,
        overdueTotal: Math.round(overdueTotal * 100) / 100,
        period: "All Time",
        recentInvoices,
      },
      error: null,
    })
  }),

  http.get("/api/reports/stock-report", async () => {
    await delay(350)
    const items = productsData.map((p) => ({
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      unit: p.unit,
      price: p.price,
      value: Math.round(p.price * p.stock * 100) / 100,
      warehouse: p.warehouse,
      status: p.stock === 0 ? "out" : p.stock < 10 ? "low" : "in",
    }))

    return HttpResponse.json({
      data: {
        totalProducts: items.length,
        totalValue: Math.round(items.reduce((s, i) => s + i.value, 0) * 100) / 100,
        lowStockCount: items.filter((i) => i.status === "low").length,
        outOfStockCount: items.filter((i) => i.status === "out").length,
        items,
      },
      error: null,
    })
  }),
]
