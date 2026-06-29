import { useState, useEffect, useCallback } from "react"
import Topbar from "../../../../components/layout/Topbar"
import DataTable from "../../../../components/ui/DataTable"
import KpiCard from "../../../../components/ui/KpiCard"
import { Badge } from "../../../../components/ui/badge"
import { hrmsService } from "../../services"
import type { AttendanceRecord } from "../../types"
import { CalendarDays, CheckCircle2, XCircle, AlertTriangle, Home } from "lucide-react"

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  Present: "success",
  Absent: "danger",
  Late: "warning",
  "Half Day": "info",
  "Work From Home": "info",
}

function formatHours(h: number) {
  return `${h.toFixed(1)}h`
}

export default function Attendance() {
  const [data, setData] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const fetchAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = { page, limit: 30 }
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      const res = await hrmsService.getAttendance(params)
      setData(res.items)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [page, dateFrom, dateTo])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  const present = data.filter((r) => r.status === "Present").length
  const absent = data.filter((r) => r.status === "Absent").length
  const late = data.filter((r) => r.status === "Late").length
  const halfDay = data.filter((r) => r.status === "Half Day").length
  const wfh = data.filter((r) => r.status === "Work From Home").length

  const columns = [
    {
      key: "date",
      header: "Date",
      render: (r: AttendanceRecord) => new Date(r.date).toLocaleDateString(),
    },
    { key: "employeeId", header: "Employee ID" },
    {
      key: "checkIn",
      header: "Check In",
      render: (r: AttendanceRecord) => r.checkIn ?? "\u2014",
    },
    {
      key: "checkOut",
      header: "Check Out",
      render: (r: AttendanceRecord) => r.checkOut ?? "\u2014",
    },
    {
      key: "status",
      header: "Status",
      render: (r: AttendanceRecord) => (
        <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
      ),
    },
    {
      key: "workingHours",
      header: "Working Hours",
      render: (r: AttendanceRecord) => formatHours(r.workingHours),
    },
    {
      key: "overtime",
      header: "Overtime",
      render: (r: AttendanceRecord) => formatHours(r.overtime),
    },
  ]

  return (
    <>
      <Topbar />
      <div className="space-y-6 p-6">
      <div>
        <h1 className="text-heading text-2xl font-semibold">Attendance</h1>
        <p className="text-muted text-sm mt-1">
          Track employee attendance and working hours
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Present Today"
          value={String(present)}
          icon={<CheckCircle2 size={20} />}
          trend={0}
          trendDirection="up"
        />
        <KpiCard
          title="Absent"
          value={String(absent)}
          icon={<XCircle size={20} />}
          trend={0}
          trendDirection="down"
        />
        <KpiCard
          title="Late"
          value={String(late)}
          icon={<AlertTriangle size={20} />}
          trend={0}
          trendDirection="up"
        />
        <KpiCard
          title="Half Day"
          value={String(halfDay)}
          icon={<CalendarDays size={20} />}
          trend={0}
          trendDirection="neutral"
        />
        <KpiCard
          title="WFH"
          value={String(wfh)}
          icon={<Home size={20} />}
          trend={0}
          trendDirection="up"
        />
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-muted font-medium mb-1.5">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-border rounded-xl px-3 py-2 text-sm text-body bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
        <div>
          <label className="block text-xs text-muted font-medium mb-1.5">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-border rounded-xl px-3 py-2 text-sm text-body bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r: AttendanceRecord) => r.id}
        loading={loading}
        page={page}
        total={total}
        onPageChange={setPage}
      />
    </div>
    </>
  )
}
