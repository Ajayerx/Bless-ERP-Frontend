import { apiClient } from "../../../services/api-client"
import type { Employee, AttendanceRecord, PayrollRecord, LeaveRequest, HrmsDashboardData } from "../types"

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const hrmsService = {
  async getEmployees(params?: { search?: string; department?: string; status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Employee>> {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined) searchParams.set(key, String(val))
      })
    }
    const qs = searchParams.toString()
    return apiClient<PaginatedResponse<Employee>>(`/hrms/employees${qs ? `?${qs}` : ""}`)
  },

  async getEmployee(id: string): Promise<Employee> {
    return apiClient<Employee>(`/hrms/employees/${id}`)
  },

  async getAttendance(params?: { employeeId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }): Promise<PaginatedResponse<AttendanceRecord>> {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined) searchParams.set(key, String(val))
      })
    }
    const qs = searchParams.toString()
    return apiClient<PaginatedResponse<AttendanceRecord>>(`/hrms/attendance${qs ? `?${qs}` : ""}`)
  },

  async getPayroll(params?: { department?: string; status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<PayrollRecord>> {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined) searchParams.set(key, String(val))
      })
    }
    const qs = searchParams.toString()
    return apiClient<PaginatedResponse<PayrollRecord>>(`/hrms/payroll${qs ? `?${qs}` : ""}`)
  },

  async getPayrollRecord(id: string): Promise<PayrollRecord> {
    return apiClient<PayrollRecord>(`/hrms/payroll/${id}`)
  },

  async getLeaveRequests(params?: { status?: string; employeeId?: string; page?: number; limit?: number }): Promise<PaginatedResponse<LeaveRequest>> {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined) searchParams.set(key, String(val))
      })
    }
    const qs = searchParams.toString()
    return apiClient<PaginatedResponse<LeaveRequest>>(`/hrms/leave${qs ? `?${qs}` : ""}`)
  },

  async getDashboard(): Promise<HrmsDashboardData> {
    return apiClient<HrmsDashboardData>("/hrms/dashboard")
  },
}
