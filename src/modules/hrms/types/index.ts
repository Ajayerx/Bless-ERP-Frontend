export interface Employee {
  id: string
  code: string
  name: string
  email: string
  phone: string
  photo?: string
  department: string
  designation: string
  employmentType: "Full-time" | "Part-time" | "Contract" | "Intern"
  shift: "Morning" | "Evening" | "Night" | "Flexible"
  manager: string
  salaryStructure: string
  joiningDate: string
  status: "Active" | "On Leave" | "Resigned" | "Terminated"
  createdAt: string
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: "Present" | "Absent" | "Late" | "Half Day" | "Work From Home"
  workingHours: number
  overtime: number
}

export interface PayrollRecord {
  id: string
  employeeId: string
  employeeName: string
  department: string
  month: string
  year: number
  basicSalary: number
  allowances: number
  bonus: number
  tax: number
  pf: number
  insurance: number
  otherDeductions: number
  grossSalary: number
  totalDeductions: number
  netSalary: number
  status: "Draft" | "Processing" | "Paid" | "Failed"
  processedAt?: string
}

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  leaveType: "Casual Leave" | "Sick Leave" | "Annual Leave" | "Work From Home" | "Maternity Leave" | "Paternity Leave"
  startDate: string
  endDate: string
  days: number
  reason: string
  attachment?: string
  status: "Pending" | "Approved" | "Rejected" | "Cancelled"
  approvedBy?: string
  comments?: string
  createdAt: string
}

export interface HrmsDashboardData {
  totalEmployees: number
  presentToday: number
  absentToday: number
  lateToday: number
  onLeave: number
  pendingLeaveRequests: number
  monthlyPayrollCost: number
  pendingPayroll: number
  processedPayroll: number
}

export interface AttendanceSummary {
  present: number
  absent: number
  late: number
  halfDay: number
  workFromHome: number
}
