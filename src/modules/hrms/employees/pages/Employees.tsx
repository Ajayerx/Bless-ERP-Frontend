"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Users, UserCheck, UserX, UserMinus, Eye } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import KpiCard from "@/components/ui/KpiCard"
import { Button, Badge } from "@/components/ui"
import { hrmsService } from "../../services"
import type { Employee } from "../../types"

const departments = ["All", "Engineering", "Sales", "Marketing", "Finance", "HR", "Operations", "Support", "Design", "Legal", "R&D"]
const statuses = ["All", "Active", "On Leave", "Resigned", "Terminated"]

const statusVariant: Record<string, "success" | "warning" | "danger" | "default"> = {
  Active: "success",
  "On Leave": "warning",
  Resigned: "default",
  Terminated: "danger",
}

const columns: Column<Employee>[] = [
  { key: "code", header: "Code" },
  {
    key: "name",
    header: "Name",
    render: (e) => <span className="font-semibold text-heading">{e.name}</span>,
  },
  { key: "department", header: "Department" },
  { key: "designation", header: "Designation" },
  { key: "employmentType", header: "Employment Type" },
  {
    key: "status",
    header: "Status",
    render: (e) => (
      <Badge variant={statusVariant[e.status] ?? "default"}>{e.status}</Badge>
    ),
  },
  {
    key: "actions",
    header: "",
    render: () => (
      <Button variant="ghost" size="sm">
        <Eye size={14} />
        View
      </Button>
    ),
  },
]

export default function Employees() {
  const navigate = useNavigate()
  const [data, setData] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [department, setDepartment] = useState("All")
  const [status, setStatus] = useState("All")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 10 }
      if (search) params.search = search
      if (department && department !== "All") params.department = department
      if (status && status !== "All") params.status = status
      const result = await hrmsService.getEmployees(params)
      setData(result.items)
      setTotal(result.total)

    } finally {
      setLoading(false)
    }
  }, [search, department, status, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Employees</h1>
            <p className="text-sm text-muted mt-1">Manage your workforce.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Active"
            value={String(data.filter((e) => e.status === "Active").length)}
            trend={0}
            trendDirection="up"
            icon={<Users size={18} />}
          />
          <KpiCard
            title="On Leave"
            value={String(data.filter((e) => e.status === "On Leave").length)}
            trend={0}
            trendDirection="neutral"
            icon={<UserMinus size={18} />}
          />
          <KpiCard
            title="Resigned"
            value={String(data.filter((e) => e.status === "Resigned").length)}
            trend={0}
            trendDirection="down"
            icon={<UserX size={18} />}
          />
          <KpiCard
            title="Terminated"
            value={String(data.filter((e) => e.status === "Terminated").length)}
            trend={0}
            trendDirection="down"
            icon={<UserCheck size={18} />}
          />
        </div>

        <DataTable
          columns={columns}
          data={data}
          keyExtractor={(e) => e.id}
          searchable
          searchPlaceholder="Search by name, email or code..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(e) => navigate(`/hrms/employees/${e.id}`)}
          toolbarActions={
            <div className="flex items-center gap-3">
              <select
                value={department}
                onChange={(e) => { setDepartment(e.target.value); setPage(1) }}
                className="px-3 py-2 bg-surface border border-border rounded-input text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>{d === "All" ? "All Departments" : d}</option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                className="px-3 py-2 bg-surface border border-border rounded-input text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{s === "All" ? "All Statuses" : s}</option>
                ))}
              </select>
            </div>
          }
        />
      </motion.div>
    </>
  )
}
