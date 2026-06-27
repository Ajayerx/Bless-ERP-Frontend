import { http, HttpResponse, delay } from "msw"
import customersData from "../data/customers.json"

let customers = [...customersData]

export const customerHandlers = [
  http.get("/api/customers", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10)

    let filtered = customers
    if (search) {
      filtered = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.contactName.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          c.company?.toLowerCase().includes(search)
      )
    }

    const total = filtered.length
    const start = (page - 1) * pageSize
    const paged = filtered.slice(start, start + pageSize)

    return HttpResponse.json({
      data: {
        items: paged,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      error: null,
    })
  }),

  http.get("/api/customers/:id", async ({ params }) => {
    await delay(200)
    const customer = customers.find((c) => c.id === params.id)
    if (!customer) {
      return HttpResponse.json(
        { data: null, error: { message: "Customer not found." } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ data: customer, error: null })
  }),

  http.post("/api/customers", async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    const newCustomer = {
      id: `cus_${String(customers.length + 1).padStart(3, "0")}`,
      name: body.name as string,
      contactName: body.contactName as string,
      email: body.email as string,
      phone: body.phone as string,
      billingAddress: body.billingAddress as string,
      shippingAddress: body.shippingAddress as string,
      taxId: body.taxId as string,
      creditLimit: body.creditLimit as number,
      outstanding: 0,
      status: "active",
      createdAt: new Date().toISOString(),
    }
    customers = [newCustomer, ...customers]
    return HttpResponse.json({ data: newCustomer, error: null }, { status: 201 })
  }),

  http.put("/api/customers/:id", async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as Record<string, unknown>
    const idx = customers.findIndex((c) => c.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, error: { message: "Customer not found." } },
        { status: 404 }
      )
    }
    customers[idx] = { ...customers[idx], ...(body as any) }
    return HttpResponse.json({ data: customers[idx], error: null })
  }),

  http.delete("/api/customers/:id", async ({ params }) => {
    await delay(200)
    customers = customers.filter((c) => c.id !== params.id)
    return HttpResponse.json({ data: null, error: null })
  }),
]
