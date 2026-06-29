"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Mail, Phone, Building2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge, Avatar } from "@/components/ui"
import { vendorService, type Vendor, type VendorListResponse } from "@/services"
import VendorForm from "@/modules/purchases/components/VendorForm"

const columns: Column<Vendor>[] = [
  {
    key: "name",
    header: "Vendor",
    render: (v) => (
      <div className="flex items-center gap-3">
        <Avatar name={v.name} size="sm" />
        <div>
          <p className="font-semibold text-heading">{v.name}</p>
          <p className="text-xs text-muted">{v.contactName}</p>
        </div>
      </div>
    ),
  },
  {
    key: "email",
    header: "Contact",
    hideOnMobile: true,
    render: (v) => (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Mail size={12} />
          {v.email}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Phone size={12} />
          {v.phone}
        </div>
      </div>
    ),
  },
  {
    key: "taxId",
    header: "Tax ID",
    hideOnMobile: true,
    render: (v) => <span className="text-xs text-muted">{v.taxId || "—"}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (v) => (
      <Badge variant={v.status === "active" ? "success" : "default"}>
        {v.status === "active" ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    hideOnMobile: true,
    render: (v) => (
      <span className="text-xs text-muted">
        {new Date(v.createdAt).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        })}
      </span>
    ),
  },
]

export default function Vendors() {
  const navigate = useNavigate()
  const [data, setData] = useState<VendorListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await vendorService.list({ search, page, pageSize: 10 })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

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
            <h1 className="text-2xl font-bold text-heading">Vendors</h1>
            <p className="text-sm text-muted mt-1">Manage your vendor directory.</p>
          </div>
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            Add Vendor
          </Button>
        </div>

        {data && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Building2 size={16} />
            <span>
              <strong className="text-heading">{data.total}</strong> total vendors
            </span>
          </div>
        )}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(v) => v.id}
          searchable
          searchPlaceholder="Search vendors..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(v) => navigate(`/purchases/vendors/${v.id}`)}
        />
      </motion.div>

      <VendorForm
        open={formOpen}
        onSaved={() => { setFormOpen(false); fetchData() }}
        onCancel={() => setFormOpen(false)}
      />
    </>
  )
}
