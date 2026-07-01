import { http, HttpResponse, delay } from "msw"
import expensesData from "../data/expenses.json"

let expenses = [...expensesData]

export const expenseHandlers = [
  http.get("/api/expenses", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const category = url.searchParams.get("category") ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = expenses
    if (search) filtered = expenses.filter((e) => e.description.toLowerCase().includes(search) || e.supplier.toLowerCase().includes(search))
    if (category) filtered = filtered.filter((e) => e.category === category)

    const total = filtered.length
    const start = (page - 1) * pageSize
    const paged = filtered.slice(start, start + pageSize)

    return HttpResponse.json({
      data: { items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      error: null,
    })
  }),

  http.get("/api/expenses/:id", async ({ params }) => {
    await delay(200)
    const expense = expenses.find((e) => e.id === params.id)
    if (!expense) return HttpResponse.json({ data: null, error: { message: "Expense not found." } }, { status: 404 })
    return HttpResponse.json({ data: expense, error: null })
  }),

  http.post("/api/expenses", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newExpense = { id: `exp_${Date.now()}`, ...body, createdAt: new Date().toISOString() }
    expenses = [newExpense, ...expenses] as any
    return HttpResponse.json({ data: newExpense, error: null }, { status: 201 })
  }),

  http.put("/api/expenses/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = expenses.findIndex((e) => e.id === params.id)
    if (idx === -1) return HttpResponse.json({ data: null, error: { message: "Expense not found." } }, { status: 404 })
    expenses[idx] = { ...expenses[idx], ...(body as any) }
    return HttpResponse.json({ data: expenses[idx], error: null })
  }),
]
