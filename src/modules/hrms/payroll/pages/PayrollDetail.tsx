import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Topbar from "../../../../components/layout/Topbar"
import { Button } from "../../../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Badge } from "../../../../components/ui/badge"
import { hrmsService } from "../../services"
import type { PayrollRecord } from "../../types"
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react"

const formatCurrency = (val: number) =>
  val.toLocaleString("en-US", { style: "currency", currency: "USD" })

const statusVariant: Record<string, "success" | "warning" | "default" | "danger"> = {
  Paid: "success",
  Processing: "warning",
  Draft: "default",
  Failed: "danger",
}

const statusIcon: Record<string, React.ReactNode> = {
  Paid: <CheckCircle2 size={16} />,
  Processing: <Clock size={16} />,
  Draft: <Clock size={16} />,
  Failed: <XCircle size={16} />,
}

function DetailRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={`text-sm font-semibold ${
          positive !== undefined
            ? positive
              ? "text-success-600"
              : "text-danger-600"
            : "text-body"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-6 pb-4">{children}</div>
      </CardContent>
    </Card>
  )
}

export default function PayrollDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [record, setRecord] = useState<PayrollRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    hrmsService
      .getPayrollRecord(id)
      .then(setRecord)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </>
    )
  }

  if (error || !record) {
    return (
      <>
        <Topbar />
        <div className="flex flex-col items-center justify-center h-64 gap-4">
        <XCircle size={48} className="text-danger-500" />
        <p className="text-lg font-semibold text-heading">Payroll Record Not Found</p>
        <p className="text-sm text-muted">The requested payroll record could not be found.</p>
        <Button variant="secondary" onClick={() => navigate("/hrms/payroll")}>
          <ArrowLeft size={16} />
          Back to Payroll
        </Button>
      </div>
      </>
    )
  }

  return (
    <>
      <Topbar />
      <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/hrms/payroll")}>
          <ArrowLeft size={16} />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-heading">{record.employeeName}</h1>
          <p className="text-sm text-muted mt-1">
            Payroll Record &mdash; {record.month} {record.year}
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant={statusVariant[record.status] || "default"}>
            <span className="flex items-center gap-1">
              {statusIcon[record.status]}
              {record.status}
            </span>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <SectionCard title="Employee Info">
            <DetailRow label="Employee Name" value={record.employeeName} />
            <DetailRow label="Department" value={record.department} />
            <DetailRow label="Month" value={record.month} />
            <DetailRow label="Year" value={String(record.year)} />
            {record.processedAt && (
              <DetailRow
                label="Processed Date"
                value={new Date(record.processedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              />
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Income">
            <DetailRow label="Basic Salary" value={formatCurrency(record.basicSalary)} positive />
            <DetailRow label="Allowances" value={formatCurrency(record.allowances)} positive />
            {record.bonus > 0 && (
              <DetailRow label="Bonus" value={formatCurrency(record.bonus)} positive />
            )}
            <DetailRow label="Gross Salary" value={formatCurrency(record.grossSalary)} positive />
          </SectionCard>

          <SectionCard title="Deductions">
            {record.tax > 0 && <DetailRow label="Tax" value={formatCurrency(record.tax)} positive={false} />}
            {record.pf > 0 && <DetailRow label="PF" value={formatCurrency(record.pf)} positive={false} />}
            {record.insurance > 0 && (
              <DetailRow label="Insurance" value={formatCurrency(record.insurance)} positive={false} />
            )}
            {record.otherDeductions > 0 && (
              <DetailRow
                label="Other Deductions"
                value={formatCurrency(record.otherDeductions)}
                positive={false}
              />
            )}
            <DetailRow
              label="Total Deductions"
              value={formatCurrency(record.totalDeductions)}
              positive={false}
            />
          </SectionCard>

          <Card className="border-success-500/30 bg-success-50/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-heading">Net Salary</span>
                <span className="text-2xl font-bold text-success-600">
                  {formatCurrency(record.netSalary)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  )
}
