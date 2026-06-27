import type { Employee, AttendanceRecord, PayrollRecord, LeaveRequest } from "../types"

const firstNames = ["James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth","William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Christopher","Karen","Daniel","Lisa","Matthew","Nancy","Andrew","Betty","Joshua","Margaret","Ryan","Sandra","Brandon","Ashley","Justin","Dorothy","Nicholas","Kimberly","Eric","Donna","Jacob","Helen","Lucas","Carol","Ethan","Sharon","Alexander","Michelle","Benjamin","Laura","Samuel","Emily"]
const lastNames = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts"]
const departments = ["Engineering","Sales","Marketing","Finance","HR","Operations","Support","Design","Legal","R&D"]
const designations: Record<string, string[]> = {
  Engineering: ["Software Engineer","Senior Engineer","Tech Lead","Engineering Manager","Principal Engineer","DevOps Engineer"],
  Sales: ["Sales Rep","Senior Sales Rep","Account Manager","Sales Manager","VP of Sales"],
  Marketing: ["Marketing Specialist","Content Writer","SEO Lead","Marketing Manager","Brand Strategist"],
  Finance: ["Accountant","Senior Accountant","Finance Manager","CFO","Auditor"],
  HR: ["HR Coordinator","HR Manager","Recruiter","Talent Acquisition Lead"],
  Operations: ["Operations Analyst","Operations Manager","Supply Chain Lead","Logistics Coordinator"],
  Support: ["Support Agent","Senior Support Agent","Support Manager","Customer Success Lead"],
  Design: ["Junior Designer","UI/UX Designer","Senior Designer","Design Lead","Creative Director"],
  Legal: ["Paralegal","Legal Counsel","Senior Counsel","Head of Legal"],
  "R&D": ["Research Scientist","Product Researcher","Innovation Lead","R&D Manager"],
}
const managers = ["Alice Thompson","Bob Martinez","Carol Davis","David Wilson","Eva Gonzalez","Frank Anderson","Grace Lee","Henry Clark","Irene White","Jack Harris"]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  return d.toISOString().slice(0, 10)
}

function generateEmployeeCode(index: number): string {
  return `EMP-${String(index + 1).padStart(4, "0")}`
}

export function generateEmployees(count: number): Employee[] {
  const employees: Employee[] = []
  for (let i = 0; i < count; i++) {
    const name = `${randomItem(firstNames)} ${randomItem(lastNames)}`
    const dept = randomItem(departments)
    const deptDesignations = designations[dept]
    const joiningDate = randomDate(new Date("2019-01-01"), new Date("2025-12-31"))
    const status = i < count * 0.85 ? randomItem(["Active", "Active", "Active", "On Leave"] as const) : randomItem(["Resigned", "Terminated"] as const)

    employees.push({
      id: `emp_${String(i + 1).padStart(3, "0")}`,
      code: generateEmployeeCode(i),
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@blesserp.com`,
      phone: `+1 (${randomInt(200, 999)}) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
      department: dept,
      designation: randomItem(deptDesignations),
      employmentType: randomItem(["Full-time", "Full-time", "Full-time", "Part-time", "Contract", "Intern"]),
      shift: randomItem(["Morning", "Morning", "Evening", "Night", "Flexible"]),
      manager: randomItem(managers),
      salaryStructure: `Level ${randomInt(3, 12)}`,
      joiningDate,
      status: status as Employee["status"],
      createdAt: joiningDate,
    })
  }
  return employees
}

export function generateAttendance(employees: Employee[], daysBack: number): AttendanceRecord[] {
  const records: AttendanceRecord[] = []
  const statuses: AttendanceRecord["status"][] = ["Present", "Present", "Present", "Present", "Present", "Present", "Absent", "Late", "Half Day", "Work From Home"]
  const now = new Date()

  for (const emp of employees) {
    if (emp.status !== "Active" && emp.status !== "On Leave") continue
    const daysInPeriod = randomInt(18, daysBack)
    for (let d = 0; d < daysInPeriod; d++) {
      const date = new Date(now)
      date.setDate(date.getDate() - d)
      if (date.getDay() === 0 || date.getDay() === 6) continue
      const dateStr = date.toISOString().slice(0, 10)
      const status = emp.status === "On Leave" ? "Absent" : randomItem(statuses)
      const checkInHour = status === "Late" ? randomInt(9, 10) : randomInt(7, 8)
      const checkInMin = randomInt(0, 59)
      const checkOutHour = status === "Half Day" ? randomInt(12, 13) : randomInt(16, 18)
      const checkOutMin = randomInt(0, 59)
      const workingHours = status === "Half Day" ? (4 + Math.random() * 1.5) : (8 + Math.random() * 2)
      const overtime = workingHours > 8 ? Math.round((workingHours - 8) * 10) / 10 : 0

      records.push({
        id: `att_${emp.id}_${dateStr.replace(/-/g, "")}`,
        employeeId: emp.id,
        date: dateStr,
        checkIn: status === "Absent" ? null : `${String(checkInHour).padStart(2, "0")}:${String(checkInMin).padStart(2, "0")}`,
        checkOut: status === "Absent" ? null : `${String(checkOutHour).padStart(2, "0")}:${String(checkOutMin).padStart(2, "0")}`,
        status,
        workingHours: status === "Absent" ? 0 : Math.round(workingHours * 10) / 10,
        overtime: Math.round(overtime * 10) / 10,
      })
    }
  }
  return records
}

export function generatePayroll(employees: Employee[], months: number): PayrollRecord[] {
  const records: PayrollRecord[] = []
  const now = new Date()

  for (const emp of employees) {
    if (emp.status === "Resigned" || emp.status === "Terminated") continue
    const startMonth = Math.max(0, months - randomInt(1, months))
    for (let m = startMonth; m < months; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
      const basicSalary = randomInt(3500, 12000) * (emp.employmentType === "Part-time" ? 0.5 : 1)
      const allowances = Math.round(basicSalary * randomInt(10, 30) / 100)
      const bonus = m === 0 ? Math.round(basicSalary * randomInt(5, 15) / 100) : 0
      const tax = Math.round(basicSalary * randomInt(10, 20) / 100)
      const pf = Math.round(basicSalary * 0.12)
      const insurance = randomInt(200, 800)
      const otherDeductions = randomInt(0, 500)
      const grossSalary = basicSalary + allowances + bonus
      const totalDeductions = tax + pf + insurance + otherDeductions
      const netSalary = grossSalary - totalDeductions
      const status = m === 0 ? randomItem(["Processing", "Draft"] as const) : randomItem(["Paid", "Paid", "Paid", "Paid", "Processing", "Draft"] as const)

      records.push({
        id: `payroll_${emp.id}_${d.getFullYear()}_${d.getMonth() + 1}`,
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        month: d.toLocaleString("default", { month: "long" }),
        year: d.getFullYear(),
        basicSalary: Math.round(basicSalary),
        allowances: Math.round(allowances),
        bonus: Math.round(bonus),
        tax: Math.round(tax),
        pf: Math.round(pf),
        insurance: Math.round(insurance),
        otherDeductions: Math.round(otherDeductions),
        grossSalary: Math.round(grossSalary),
        totalDeductions: Math.round(totalDeductions),
        netSalary: Math.round(netSalary),
        status,
        processedAt: status === "Paid" ? randomDate(new Date(d.getFullYear(), d.getMonth(), 25), new Date(d.getFullYear(), d.getMonth() + 1, 5)) : undefined,
      })
    }
  }
  return records
}

const leaveTypes: LeaveRequest["leaveType"][] = ["Casual Leave","Sick Leave","Annual Leave","Work From Home","Maternity Leave","Paternity Leave"]

export function generateLeaveRequests(employees: Employee[], count: number): LeaveRequest[] {
  const requests: LeaveRequest[] = []
  const activeEmps = employees.filter((e) => e.status === "Active" || e.status === "On Leave")

  for (let i = 0; i < count; i++) {
    const emp = randomItem(activeEmps)
    const leaveType = randomItem(leaveTypes)
    const days = leaveType === "Maternity Leave" ? randomInt(60, 120) : leaveType === "Paternity Leave" ? randomInt(5, 15) : randomInt(1, 5)
    const startDate = randomDate(new Date("2026-03-01"), new Date("2026-07-15"))
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + days - 1)
    const statuses: LeaveRequest["status"][] = ["Pending", "Approved", "Approved", "Approved", "Rejected", "Cancelled"]
    const status = randomItem(statuses)

    requests.push({
      id: `leave_${String(i + 1).padStart(3, "0")}`,
      employeeId: emp.id,
      employeeName: emp.name,
      leaveType,
      startDate,
      endDate: endDate.toISOString().slice(0, 10),
      days,
      reason: randomItem(["Personal reasons", "Medical appointment", "Family event", "Vacation", "Not feeling well", "Travel", "Family emergency", "Doctor's visit"]),
      status,
      approvedBy: status === "Approved" ? randomItem(managers) : undefined,
      comments: status === "Rejected" ? "Insufficient team coverage during this period." : undefined,
      createdAt: randomDate(new Date("2026-03-01"), new Date()),
    })
  }
  return requests
}

let cachedEmployees: Employee[] | null = null
let cachedAttendance: AttendanceRecord[] | null = null
let cachedPayroll: PayrollRecord[] | null = null
let cachedLeaves: LeaveRequest[] | null = null

export function getEmployees(): Employee[] {
  if (!cachedEmployees) cachedEmployees = generateEmployees(100)
  return cachedEmployees
}

export function getAttendance(): AttendanceRecord[] {
  if (!cachedAttendance) {
    cachedAttendance = generateAttendance(getEmployees(), 60)
  }
  return cachedAttendance
}

export function getPayroll(): PayrollRecord[] {
  if (!cachedPayroll) cachedPayroll = generatePayroll(getEmployees(), 6)
  return cachedPayroll
}

export function getLeaveRequests(): LeaveRequest[] {
  if (!cachedLeaves) cachedLeaves = generateLeaveRequests(getEmployees(), 40)
  return cachedLeaves
}
