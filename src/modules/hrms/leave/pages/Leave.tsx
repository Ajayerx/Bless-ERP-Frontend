import { useState, useEffect, useMemo, useCallback } from "react"
import Topbar from "../../../../components/layout/Topbar"
import DataTable from "../../../../components/ui/DataTable"
import KpiCard from "../../../../components/ui/KpiCard"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card"
import { hrmsService } from "../../services"
import type { LeaveRequest } from "../../types"
import { CalendarOff, CheckCircle2, XCircle, Clock, AlertTriangle, FileText } from "lucide-react"

const STATUS_OPTIONS = ["All", "Pending", "Approved", "Rejected", "Cancelled"] as const

const statusBadgeVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  Approved: "success",
  Pending: "warning",
  Rejected: "danger",
  Cancelled: "default",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function Leave() {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<string>("All")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page }
      if (status !== "All") params.status = status
      const res = await hrmsService.getLeaveRequests(params)
      setRequests(res.items)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const kpis = useMemo(() => {
    const pending = requests.filter((r) => r.status === "Pending").length
    const approved = requests.filter((r) => r.status === "Approved").length
    const rejected = requests.filter((r) => r.status === "Rejected").length
    return { total, pending, approved, rejected }
  }, [requests, total])

  const columns = useMemo(
    () => [
      { key: "employeeName", header: "Employee Name" },
      { key: "leaveType", header: "Leave Type" },
      {
        key: "startDate",
        header: "Start Date",
        render: (item: LeaveRequest) => formatDate(item.startDate),
      },
      {
        key: "endDate",
        header: "End Date",
        render: (item: LeaveRequest) => formatDate(item.endDate),
      },
      { key: "days", header: "Days" },
      { key: "reason", header: "Reason" },
      {
        key: "status",
        header: "Status",
        render: (item: LeaveRequest) => (
          <Badge variant={statusBadgeVariant[item.status] ?? "default"}>
            {item.status}
          </Badge>
        ),
      },
      {
        key: "createdAt",
        header: "Created At",
        render: (item: LeaveRequest) => formatDate(item.createdAt),
      },
    ],
    []
  )

  return (
    <>
      <Topbar />
      <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Leave Management</h1>
        <p className="text-sm text-muted mt-1">Manage and track employee leave requests</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Requests"
          value={kpis.total.toString()}
          trend={0}
          trendDirection="neutral"
          icon={<FileText size={20} />}
        />
        <KpiCard
          title="Pending"
          value={kpis.pending.toString()}
          trend={0}
          trendDirection="neutral"
          icon={<Clock size={20} />}
        />
        <KpiCard
          title="Approved"
          value={kpis.approved.toString()}
          trend={0}
          trendDirection="neutral"
          icon={<CheckCircle2 size={20} />}
        />
        <KpiCard
          title="Rejected"
          value={kpis.rejected.toString()}
          trend={0}
          trendDirection="neutral"
          icon={<XCircle size={20} />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((s) => (
              <Button
                key={s}
                variant={status === s ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  setStatus(s)
                  setPage(1)
                }}
              >
                {s === "All" ? <CalendarOff size={14} /> : s === "Pending" ? <Clock size={14} /> : s === "Approved" ? <CheckCircle2 size={14} /> : s === "Rejected" ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                {s}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={requests}
            keyExtractor={(item: LeaveRequest) => item.id}
            loading={loading}
            page={page}
            total={total}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
    </>
  )
}
