"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Mail, Phone, MapPin, CreditCard } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Avatar, Skeleton } from "@/components/ui"
import { vendorService, type Vendor } from "@/services"

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    vendorService.getById(id).then(setVendor).finally(() => setLoading(false))
  }, [id])

  if (loading) return <><Topbar /><div className="p-6 space-y-6"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-3 gap-5"><Skeleton className="h-48 rounded-[16px]" /><Skeleton className="h-48 rounded-[16px]" /><Skeleton className="h-48 rounded-[16px]" /></div></div></>
  if (!vendor) return <><Topbar /><div className="p-6 text-center"><p className="text-muted">Vendor not found.</p></div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/vendors")} className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"><ArrowLeft size={20} /></button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-heading">{vendor.name}</h1>
              <Badge variant={vendor.status === "active" ? "success" : "default"}>{vendor.status === "active" ? "Active" : "Inactive"}</Badge>
            </div>
            <p className="text-sm text-muted mt-0.5">Vendor details and history.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card>
            <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={vendor.name} size="lg" />
                <div><p className="font-semibold text-heading">{vendor.contactName}</p><p className="text-xs text-muted">Primary contact</p></div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm"><Mail size={15} className="text-muted shrink-0" /><span className="text-body">{vendor.email}</span></div>
                <div className="flex items-center gap-3 text-sm"><Phone size={15} className="text-muted shrink-0" /><span className="text-body">{vendor.phone}</span></div>
                <div className="flex items-center gap-3 text-sm"><CreditCard size={15} className="text-muted shrink-0" /><span className="text-body">Tax ID: {vendor.taxId || "—"}</span></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Billing Address</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 text-sm">
                <MapPin size={15} className="text-muted shrink-0 mt-0.5" />
                <span className="text-body">{vendor.billingAddress || "No billing address on file."}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Shipping Address</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 text-sm">
                <MapPin size={15} className="text-muted shrink-0 mt-0.5" />
                <span className="text-body">{vendor.shippingAddress || "No shipping address on file."}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  )
}
