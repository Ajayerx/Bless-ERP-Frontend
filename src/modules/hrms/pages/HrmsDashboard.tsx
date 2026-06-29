import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Topbar from "../../../components/layout/Topbar"
import KpiCard from "../../../components/ui/KpiCard"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { hrmsService } from "../services"
import type { HrmsDashboardData } from "../types"
import {
  Users,
  Clock,
  CreditCard,
  CalendarCheck,
  UserMinus,
  UserPlus,
  AlertTriangle,
} from "lucide-react"

export default function HrmsDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<HrmsDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    hrmsService.getDashboard().then((res) => {
      setData(res)
      setLoading(false)
    })
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )

  if (!data) return null

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val)

  return (
    <>
      <Topbar />
      <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">HRMS Dashboard</h1>
        <p className="text-sm text-muted mt-1">Overview of your workforce and HR operations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Employees"
          value={data.totalEmployees.toLocaleString("en-IN")}
          trend={0}
          trendDirection="neutral"
          icon={<Users size={20} />}
        />
        <KpiCard
          title="Present Today"
          value={data.presentToday.toLocaleString("en-IN")}
          trend={0}
          trendDirection="neutral"
          icon={<CalendarCheck size={20} />}
        />
        <KpiCard
          title="Absent Today"
          value={data.absentToday.toLocaleString("en-IN")}
          trend={0}
          trendDirection="neutral"
          icon={<UserMinus size={20} />}
          variant="warning"
        />
        <KpiCard
          title="Late Today"
          value={data.lateToday.toLocaleString("en-IN")}
          trend={0}
          trendDirection="neutral"
          icon={<Clock size={20} />}
          variant="warning"
        />
        <KpiCard
          title="On Leave"
          value={data.onLeave.toLocaleString("en-IN")}
          trend={0}
          trendDirection="neutral"
          icon={<UserPlus size={20} />}
        />
        <KpiCard
          title="Pending Leaves"
          value={data.pendingLeaveRequests.toLocaleString("en-IN")}
          trend={0}
          trendDirection="neutral"
          icon={<AlertTriangle size={20} />}
          variant="warning"
        />
        <KpiCard
          title="Monthly Payroll"
          value={formatCurrency(data.monthlyPayrollCost)}
          trend={0}
          trendDirection="neutral"
          icon={<CreditCard size={20} />}
        />
        <KpiCard
          title="Pending Payroll"
          value={data.pendingPayroll.toLocaleString("en-IN")}
          trend={0}
          trendDirection="neutral"
          icon={<CreditCard size={20} />}
          variant="warning"
        />
        <KpiCard
          title="Processed Payroll"
          value={data.processedPayroll.toLocaleString("en-IN")}
          trend={0}
          trendDirection="neutral"
          icon={<CreditCard size={20} />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="md" onClick={() => navigate("/hrms/employees")}>
              <Users size={16} />
              Manage Employees
            </Button>
            <Button variant="secondary" size="md" onClick={() => navigate("/hrms/attendance")}>
              <Clock size={16} />
              View Attendance
            </Button>
            <Button variant="secondary" size="md" onClick={() => navigate("/hrms/payroll")}>
              <CreditCard size={16} />
              Payroll
            </Button>
            <Button variant="secondary" size="md" onClick={() => navigate("/hrms/leave")}>
              <CalendarCheck size={16} />
              Leave Requests
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  )
}
