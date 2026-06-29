"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Building2, BadgeCheck, Mail, Phone, Calendar, Clock, User, Briefcase, Banknote } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Avatar } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { hrmsService } from "../../services"
import type { Employee } from "../../types"

const statusVariant: Record<string, "success" | "warning" | "danger" | "default"> = {
  Active: "success",
  "On Leave": "warning",
  Resigned: "default",
  Terminated: "danger",
}

interface InfoRowProps {
  icon: React.ReactNode
  label: string
  value: string
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-b-0">
      <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-medium text-body truncate">{value}</p>
      </div>
    </div>
  )
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    hrmsService.getEmployee(id)
      .then(setEmployee)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Skeleton className="h-48 rounded-[16px] lg:col-span-1" />
            <Skeleton className="h-64 rounded-[16px] lg:col-span-2" />
          </div>
        </div>
      </>
    )
  }

  if (notFound || !employee) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Employee not found.</p>
          <Button className="mt-4" onClick={() => navigate("/hrms/employees")}>
            Back to Employees
          </Button>
        </div>
      </>
    )
  }

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
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{employee.name}</h1>
                <Badge variant={statusVariant[employee.status] ?? "default"}>
                  {employee.status}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">{employee.code}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Employee</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={employee.name} size="lg" />
                <div>
                  <p className="font-semibold text-heading">{employee.name}</p>
                  <p className="text-xs text-muted">{employee.code}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail size={15} className="text-muted shrink-0" />
                  <span className="text-body">{employee.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={15} className="text-muted shrink-0" />
                  <span className="text-body">{employee.phone}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow icon={<Building2 size={15} />} label="Department" value={employee.department} />
              <InfoRow icon={<BadgeCheck size={15} />} label="Designation" value={employee.designation} />
              <InfoRow icon={<Briefcase size={15} />} label="Employment Type" value={employee.employmentType} />
              <InfoRow icon={<Clock size={15} />} label="Shift" value={employee.shift} />
              <InfoRow icon={<User size={15} />} label="Manager" value={employee.manager} />
              <InfoRow icon={<Calendar size={15} />} label="Joining Date" value={employee.joiningDate} />
              <InfoRow icon={<Banknote size={15} />} label="Salary Structure" value={employee.salaryStructure} />
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  )
}
