import { http, HttpResponse, delay } from "msw"
import expensesData from "../data/accounting/expenses.json"
import bankAccountsData from "../data/accounting/bank-accounts.json"
import journalEntriesData from "../data/accounting/journal-entries.json"

let expenses = [...expensesData]
let bankAccounts = [...bankAccountsData]
let journalEntries = [...journalEntriesData]

function paginate<T>(items: T[], url: URL): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  const search = url.searchParams.get("search")?.toLowerCase() ?? ""
  const page = parseInt(url.searchParams.get("page") ?? "1", 10)
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

  let filtered = items
  if (search) {
    filtered = filtered.filter((item: any) =>
      Object.values(item).some((v) => String(v).toLowerCase().includes(search))
    )
  }

  const total = filtered.length
  const start = (page - 1) * pageSize
  const paged = filtered.slice(start, start + pageSize)

  return { items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export const accountingHandlers = [
  // --- Expenses ---
  http.get("/api/expenses", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    return HttpResponse.json({ data: paginate(expenses, url), error: null })
  }),

  http.get("/api/expenses/:id", async ({ params }) => {
    await delay(200)
    const expense = expenses.find((e) => e.id === params.id)
    if (!expense) {
      return HttpResponse.json({ data: null, error: { message: "Expense not found." } }, { status: 404 })
    }
    return HttpResponse.json({ data: expense, error: null })
  }),

  http.post("/api/expenses", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newExpense = {
      id: `exp_${String(expenses.length + 1).padStart(3, "0")}`,
      number: `EXP-2026-${String(expenses.length + 1).padStart(4, "0")}`,
      ...body,
      createdAt: new Date().toISOString(),
    } as any
    expenses = [newExpense, ...expenses]
    return HttpResponse.json({ data: newExpense, error: null }, { status: 201 })
  }),

  http.put("/api/expenses/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = expenses.findIndex((e) => e.id === params.id)
    if (idx === -1) {
      return HttpResponse.json({ data: null, error: { message: "Expense not found." } }, { status: 404 })
    }
    expenses[idx] = { ...expenses[idx], ...(body as any) }
    return HttpResponse.json({ data: expenses[idx], error: null })
  }),

  // --- Tax Summary ---
  http.get("/api/accounting/tax-summary", async () => {
    await delay(300)
    const totalGstCollected = 592.50
    const totalQstCollected = 197.51
    const totalGstPaid = 135.75
    const totalQstPaid = 299.25
    return HttpResponse.json({
      data: {
        period: "June 2026",
        totalCollected: 789.01,
        totalPaid: 435.00,
        netDue: 354.01,
        gstCollected: totalGstCollected,
        qstCollected: totalQstCollected,
        gstPaid: totalGstPaid,
        qstPaid: totalQstPaid,
        breakdown: [
          { id: "tb_001", reference: "SO-2026-0001", vendorOrCustomer: "Acme Corp", date: "2026-06-02", type: "sales", subtotal: 709.90, gst: 35.50, qst: 0, total: 745.40 },
          { id: "tb_002", reference: "SO-2026-0002", vendorOrCustomer: "BuildRight Construction", date: "2026-06-06", type: "sales", subtotal: 1980.00, gst: 0, qst: 197.51, total: 2177.51 },
          { id: "tb_003", reference: "SO-2026-0003", vendorOrCustomer: "Precision Parts Ltd", date: "2026-06-11", type: "sales", subtotal: 6200.00, gst: 310.00, qst: 0, total: 6510.00 },
          { id: "tb_004", reference: "SO-2026-0004", vendorOrCustomer: "Gulf Coast Supplies", date: "2026-06-15", type: "sales", subtotal: 5550.00, gst: 277.50, qst: 0, total: 5827.50 },
          { id: "tb_005", reference: "EXP-2026-0001", vendorOrCustomer: "Office Depot", date: "2026-06-02", type: "purchase", subtotal: 450.00, gst: 22.50, qst: 0, total: 472.50 },
          { id: "tb_006", reference: "EXP-2026-0002", vendorOrCustomer: "Tech Solutions Inc", date: "2026-06-05", type: "purchase", subtotal: 1200.00, gst: 60.00, qst: 0, total: 1260.00 },
          { id: "tb_007", reference: "EXP-2026-0003", vendorOrCustomer: "National Power Co", date: "2026-06-10", type: "purchase", subtotal: 890.00, gst: 44.50, qst: 0, total: 934.50 },
          { id: "tb_008", reference: "EXP-2026-0004", vendorOrCustomer: "Goodman & Associates", date: "2026-06-15", type: "purchase", subtotal: 3000.00, gst: 0, qst: 299.25, total: 3299.25 },
        ],
      },
      error: null,
    })
  }),

  // --- Bank Accounts ---
  http.get("/api/bank-accounts", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    return HttpResponse.json({ data: paginate(bankAccounts, url), error: null })
  }),

  http.get("/api/bank-accounts/:id", async ({ params }) => {
    await delay(200)
    const acc = bankAccounts.find((a) => a.id === params.id)
    if (!acc) {
      return HttpResponse.json({ data: null, error: { message: "Bank account not found." } }, { status: 404 })
    }
    return HttpResponse.json({ data: acc, error: null })
  }),

  http.post("/api/bank-accounts", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newAcc = {
      id: `ba_${String(bankAccounts.length + 1).padStart(3, "0")}`,
      ...body,
      status: "active",
      createdAt: new Date().toISOString(),
    } as any
    bankAccounts = [newAcc, ...bankAccounts]
    return HttpResponse.json({ data: newAcc, error: null }, { status: 201 })
  }),

  http.put("/api/bank-accounts/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = bankAccounts.findIndex((a) => a.id === params.id)
    if (idx === -1) {
      return HttpResponse.json({ data: null, error: { message: "Bank account not found." } }, { status: 404 })
    }
    bankAccounts[idx] = { ...bankAccounts[idx], ...(body as any) }
    return HttpResponse.json({ data: bankAccounts[idx], error: null })
  }),

  // --- Journal Entries ---
  http.get("/api/journal-entries", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    return HttpResponse.json({ data: paginate(journalEntries, url), error: null })
  }),

  http.get("/api/journal-entries/:id", async ({ params }) => {
    await delay(200)
    const je = journalEntries.find((j) => j.id === params.id)
    if (!je) {
      return HttpResponse.json({ data: null, error: { message: "Journal entry not found." } }, { status: 404 })
    }
    return HttpResponse.json({ data: je, error: null })
  }),

  http.post("/api/journal-entries", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newEntry = {
      id: `je_${String(journalEntries.length + 1).padStart(3, "0")}`,
      number: `JE-2026-${String(journalEntries.length + 1).padStart(4, "0")}`,
      ...body,
      status: "draft",
      createdAt: new Date().toISOString(),
    } as any
    journalEntries = [newEntry, ...journalEntries]
    return HttpResponse.json({ data: newEntry, error: null }, { status: 201 })
  }),

  http.put("/api/journal-entries/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = journalEntries.findIndex((j) => j.id === params.id)
    if (idx === -1) {
      return HttpResponse.json({ data: null, error: { message: "Journal entry not found." } }, { status: 404 })
    }
    journalEntries[idx] = { ...journalEntries[idx], ...(body as any) }
    return HttpResponse.json({ data: journalEntries[idx], error: null })
  }),
]
