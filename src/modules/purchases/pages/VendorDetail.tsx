"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Mail, Phone, MapPin, CreditCard, Receipt } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable from "@/components/ui/DataTable"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Avatar } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { vendorService, billService, type Vendor, type Bill } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

const billColumns = [
  { key: "number", header: "Bill", render: (b: Bill) => (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
        <Receipt size={14} />
      </div>
      <div>
        <p className="font-semibold text-heading text-sm">{b.number}</p>
        <p className="text-xs text-muted">{formatDate(b.issueDate)}</p>
      </div>
    </div>
  )},
  { key: "total", header: "Amount", className: "text-right", render: (b: Bill) => (
    <span className="font-semibold tabular-nums text-heading text-sm">{formatCurrency(b.total)}</span>
  )},
  { key: "status", header: "Status", render: (b: Bill) => {
    const colors: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
      paid: "success", pending: "info", draft: "warning", overdue: "danger", cancelled: "default",
    }
    return <Badge variant={colors[b.status] ?? "default"}>{b.status.charAt(0).toUpperCase() + b.status.slice(1)}</Badge>
  }},
]

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      vendorService.getById(id),
      billService.list({ pageSize: 50 }),
    ]).then(([vend, billData]) => {
      setVendor(vend)
      setBills(billData.items.filter((b) => b.vendorName === vend.name))
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Skeleton className="h-48 rounded-[16px] lg:col-span-1" />
            <Skeleton className="h-48 rounded-[16px] lg:col-span-2" />
          </div>
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!vendor) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Vendor not found.</p>
          <Button className="mt-4" onClick={() => navigate("/purchases/vendors")}>Back to Vendors</Button>
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
            <button onClick={() => navigate("/purchases/vendors")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{vendor.name}</h1>
                <Badge variant={vendor.status === "active" ? "success" : "default"}>
                  {vendor.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">Vendor details and history.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={vendor.name} size="lg" />
                <div>
                  <p className="font-semibold text-heading">{vendor.contactName}</p>
                  <p className="text-xs text-muted">Primary contact</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail size={15} className="text-muted shrink-0" />
                  <span className="text-body">{vendor.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={15} className="text-muted shrink-0" />
                  <span className="text-body">{vendor.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CreditCard size={15} className="text-muted shrink-0" />
                  <span className="text-body">Tax ID: {vendor.taxId || "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing Address</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 text-sm">
                <MapPin size={15} className="text-muted shrink-0 mt-0.5" />
                <span className="text-body">{vendor.billingAddress || "No billing address on file."}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 text-sm">
                <MapPin size={15} className="text-muted shrink-0 mt-0.5" />
                <span className="text-body">{vendor.shippingAddress || "No shipping address on file."}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Bill History</CardTitle>
          </CardHeader>
          <DataTable
            columns={billColumns}
            data={bills}
            keyExtractor={(b) => b.id}
            pageSize={10}
            emptyState={
              <div className="text-center py-8">
                <p className="font-semibold text-body">No bills</p>
                <p className="text-xs text-muted mt-1">This vendor has no bills yet.</p>
              </div>
            }
            onRowClick={(b) => navigate(`/purchases/bills/${b.id}`)}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">Notes functionality coming soon.</p>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
