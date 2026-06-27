"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Plus, Edit3, Trash2, Mail, Phone, Users, Search } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Button, Badge, Avatar } from "@/components/ui"
import { customerService, type Customer, type CustomerListResponse } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

const columns: Column<Customer>[] = [
  {
    key: "name",
    header: "Customer",
    render: (c) => (
      <div className="flex items-center gap-3">
        <Avatar name={c.name} size="sm" />
        <div>
          <p className="font-semibold text-heading">{c.name}</p>
          <p className="text-xs text-muted">{c.contactName}</p>
        </div>
      </div>
    ),
  },
  {
    key: "email",
    header: "Contact",
    hideOnMobile: true,
    render: (c) => (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Mail size={12} />
          {c.email}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Phone size={12} />
          {c.phone}
        </div>
      </div>
    ),
  },
  {
    key: "outstanding",
    header: "Outstanding",
    className: "text-right",
    render: (c) => (
      <span className={cn("font-semibold tabular-nums", c.outstanding > 0 ? "text-heading" : "text-muted")}>
        {c.outstanding > 0 ? formatCurrency(c.outstanding) : "—"}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (c) => (
      <Badge variant={c.status === "active" ? "success" : "default"}>
        {c.status === "active" ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    hideOnMobile: true,
    render: (c) => (
      <span className="text-xs text-muted">
        {new Date(c.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </span>
    ),
  },
]

export default function Customers() {
  const [data, setData] = useState<CustomerListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await customerService.list({ search, page, pageSize: 10 })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDelete = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation()
    if (!window.confirm(`Delete ${customer.name}?`)) return
    await customerService.delete(customer.id)
    fetchData()
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Customers</h1>
            <p className="text-sm text-muted mt-1">Manage your customer directory.</p>
          </div>
          <Button>
            <Plus size={16} />
            Add Customer
          </Button>
        </div>

        {/* Summary */}
        {data && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Users size={16} />
            <span>
              <strong className="text-heading">{data.total}</strong> total customers
            </span>
          </div>
        )}

        {/* Table */}
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(c) => c.id}
          searchable
          searchPlaceholder="Search customers..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          toolbarActions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm">
                Export
              </Button>
              <Button variant="secondary" size="sm">
                Import
              </Button>
            </div>
          }
        />
      </motion.div>
    </>
  )
}
