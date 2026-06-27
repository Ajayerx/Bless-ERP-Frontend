import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import Topbar from "../../../../components/layout/Topbar"
import DataTable from "../../../../components/ui/DataTable"
import KpiCard from "../../../../components/ui/KpiCard"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import { Card, CardContent } from "../../../../components/ui/card"
import { hrmsService } from "../../services"
import type { PayrollRecord } from "../../types"
import { DollarSign, CreditCard, CheckCircle2, Clock } from "lucide-react"

const PAGE_LIMIT = 10

const formatCurrency = (val: number) =>
  val.toLocaleString("en-US", { style: "currency", currency: "USD" })

const statusVariant: Record<string, "success" | "warning" | "default" | "danger"> = {
  Paid: "success",
  Processing: "warning",
  Draft: "default",
  Failed: "danger",
}

const statusOptions = ["Draft", "Processing", "Paid", "Failed"]

export default function Payroll() {
  const navigate = useNavigate()
  const [data, setData] = useState<{
    items: PayrollRecord[]
    total: number
    page: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [department, setDepartment] = useState("")
  const [status, setStatus] = useState("")

  useEffect(() => {
    setLoading(true)
    hrmsService
      .getPayroll({
        page,
        department: department || undefined,
        status: status || undefined,
        limit: PAGE_LIMIT,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [page, department, status])

  const kpi = useMemo(() => {
    if (!data) return null
    const items = data.items
    return {
      totalCost: items.reduce((sum, r) => sum + r.grossSalary, 0),
      paidCount: items.filter((r) => r.status === "Paid").length,
      processingCount: items.filter((r) => r.status === "Processing").length,
      draftCount: items.filter((r) => r.status === "Draft").length,
    }
  }, [data])

  const departments = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.items.map((r) => r.department))).sort()
  }, [data])

  const columns = [
    { key: "employeeName", header: "Employee Name" },
    { key: "department", header: "Department" },
    { key: "month", header: "Month" },
    { key: "year", header: "Year" },
    {
      key: "basicSalary",
      header: "Basic Salary",
      render: (r: PayrollRecord) => formatCurrency(r.basicSalary),
    },
    {
      key: "allowances",
      header: "Allowances",
      render: (r: PayrollRecord) => formatCurrency(r.allowances),
    },
    {
      key: "grossSalary",
      header: "Gross Salary",
      render: (r: PayrollRecord) => formatCurrency(r.grossSalary),
    },
    {
      key: "totalDeductions",
      header: "Deductions",
      render: (r: PayrollRecord) => formatCurrency(r.totalDeductions),
    },
    {
      key: "netSalary",
      header: "Net Salary",
      render: (r: PayrollRecord) => formatCurrency(r.netSalary),
    },
    {
      key: "status",
      header: "Status",
      render: (r: PayrollRecord) => (
        <Badge variant={statusVariant[r.status] || "default"}>{r.status}</Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r: PayrollRecord) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            navigate(`/hrms/payroll/${r.id}`)
          }}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <>
      <Topbar />
      <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Payroll</h1>
        <p className="text-sm text-muted mt-1">Manage payroll records</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Payroll Cost"
          value={formatCurrency(kpi?.totalCost ?? 0)}
          trend={0}
          trendDirection="neutral"
          icon={<DollarSign size={20} />}
        />
        <KpiCard
          title="Paid"
          value={String(kpi?.paidCount ?? 0)}
          trend={0}
          trendDirection="neutral"
          icon={<CheckCircle2 size={20} />}
        />
        <KpiCard
          title="Processing"
          value={String(kpi?.processingCount ?? 0)}
          trend={0}
          trendDirection="neutral"
          icon={<Clock size={20} />}
        />
        <KpiCard
          title="Draft"
          value={String(kpi?.draftCount ?? 0)}
          trend={0}
          trendDirection="neutral"
          icon={<CreditCard size={20} />}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 bg-surface border border-border rounded-xl text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 bg-surface border border-border rounded-xl text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">All Status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(r: PayrollRecord) => r.id}
        loading={loading}
        page={data?.page ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onRowClick={(r: PayrollRecord) => navigate(`/hrms/payroll/${r.id}`)}
      />
    </div>
    </>
  )
}
