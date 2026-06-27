import { http, HttpResponse, delay } from "msw"
import { getEmployees, getAttendance, getPayroll, getLeaveRequests } from "../../modules/hrms/mock-data"

export const hrmsHandlers = [
  http.get("/api/hrms/employees", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.toLowerCase()
    const department = url.searchParams.get("department")
    const status = url.searchParams.get("status")
    const page = parseInt(url.searchParams.get("page") || "1")
    const limit = parseInt(url.searchParams.get("limit") || "20")

    let employees = getEmployees()

    if (search) {
      employees = employees.filter(
        (e) => e.name.toLowerCase().includes(search) || e.email.toLowerCase().includes(search) || e.code.toLowerCase().includes(search)
      )
    }
    if (department) employees = employees.filter((e) => e.department === department)
    if (status) employees = employees.filter((e) => e.status === status)

    const total = employees.length
    const start = (page - 1) * limit
    const items = employees.slice(start, start + limit)

    return HttpResponse.json({ data: { items, total, page, limit, totalPages: Math.ceil(total / limit) }, error: null })
  }),

  http.get("/api/hrms/employees/:id", async ({ params }) => {
    await delay(200)
    const employee = getEmployees().find((e) => e.id === params.id)
    if (!employee) return HttpResponse.json({ data: null, error: "Employee not found" }, { status: 404 })
    return HttpResponse.json({ data: employee, error: null })
  }),

  http.get("/api/hrms/attendance", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const employeeId = url.searchParams.get("employeeId")
    const dateFrom = url.searchParams.get("dateFrom")
    const dateTo = url.searchParams.get("dateTo")
    const page = parseInt(url.searchParams.get("page") || "1")
    const limit = parseInt(url.searchParams.get("limit") || "50")

    let records = getAttendance()
    if (employeeId) records = records.filter((r) => r.employeeId === employeeId)
    if (dateFrom) records = records.filter((r) => r.date >= dateFrom)
    if (dateTo) records = records.filter((r) => r.date <= dateTo)

    records.sort((a, b) => b.date.localeCompare(a.date))
    const total = records.length
    const start = (page - 1) * limit
    const items = records.slice(start, start + limit)

    return HttpResponse.json({ data: { items, total, page, limit, totalPages: Math.ceil(total / limit) }, error: null })
  }),

  http.get("/api/hrms/payroll", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const department = url.searchParams.get("department")
    const status = url.searchParams.get("status")
    const page = parseInt(url.searchParams.get("page") || "1")
    const limit = parseInt(url.searchParams.get("limit") || "20")

    let records = getPayroll()
    if (department) records = records.filter((r) => r.department === department)
    if (status) records = records.filter((r) => r.status === status)

    records.sort((a, b) => b.year - a.year || new Date(b.month + " 1, 2000").getTime() - new Date(a.month + " 1, 2000").getTime())
    const total = records.length
    const start = (page - 1) * limit
    const items = records.slice(start, start + limit)

    return HttpResponse.json({ data: { items, total, page, limit, totalPages: Math.ceil(total / limit) }, error: null })
  }),

  http.get("/api/hrms/payroll/:id", async ({ params }) => {
    await delay(200)
    const record = getPayroll().find((r) => r.id === params.id)
    if (!record) return HttpResponse.json({ data: null, error: "Payroll record not found" }, { status: 404 })
    return HttpResponse.json({ data: record, error: null })
  }),

  http.get("/api/hrms/leave", async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const status = url.searchParams.get("status")
    const employeeId = url.searchParams.get("employeeId")
    const page = parseInt(url.searchParams.get("page") || "1")
    const limit = parseInt(url.searchParams.get("limit") || "20")

    let requests = getLeaveRequests()
    if (status) requests = requests.filter((r) => r.status === status)
    if (employeeId) requests = requests.filter((r) => r.employeeId === employeeId)

    requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const total = requests.length
    const start = (page - 1) * limit
    const items = requests.slice(start, start + limit)

    return HttpResponse.json({ data: { items, total, page, limit, totalPages: Math.ceil(total / limit) }, error: null })
  }),

  http.get("/api/hrms/dashboard", async () => {
    await delay(350)
    const employees = getEmployees()
    const attendance = getAttendance()
    const payroll = getPayroll()
    const leaves = getLeaveRequests()

    const today = new Date().toISOString().slice(0, 10)
    const todayRecords = attendance.filter((r) => r.date === today)
    const activeEmployees = employees.filter((e) => e.status === "Active")

    const presentToday = todayRecords.filter((r) => r.status === "Present" || r.status === "Work From Home").length
    const absentToday = todayRecords.filter((r) => r.status === "Absent").length
    const lateToday = todayRecords.filter((r) => r.status === "Late").length

    const currentMonth = new Date().toLocaleString("default", { month: "long" })
    const currentYear = new Date().getFullYear()
    const currentPayroll = payroll.filter((r) => r.month === currentMonth && r.year === currentYear)
    const monthlyPayrollCost = currentPayroll.reduce((sum, r) => sum + r.grossSalary, 0)
    const pendingPayroll = currentPayroll.filter((r) => r.status === "Draft" || r.status === "Processing").length
    const processedPayroll = currentPayroll.filter((r) => r.status === "Paid").length

    return HttpResponse.json({
      data: {
        totalEmployees: activeEmployees.length,
        presentToday,
        absentToday,
        lateToday,
        onLeave: employees.filter((e) => e.status === "On Leave").length,
        pendingLeaveRequests: leaves.filter((r) => r.status === "Pending").length,
        monthlyPayrollCost,
        pendingPayroll,
        processedPayroll,
      },
      error: null,
    })
  }),
]
