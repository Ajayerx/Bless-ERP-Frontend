"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Skeleton } from "@/components/ui"
import { useToast } from "@/components/ui/toast"
import { customerService, type CustomerDetail } from "@/services"
import CustomerForm from "../components/CustomerForm"

export default function EditCustomer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    if (!id) return
    customerService.getById(id).then(setCustomer).catch(() => null).finally(() => setLoading(false))
  }, [id])

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(`/customers/${id}`)} className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-heading">Edit Customer</h1>
            <p className="text-sm text-muted mt-0.5">{customer?.name ?? "Loading..."}</p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Button variant="secondary" onClick={() => navigate(`/customers/${id}`)}>Cancel</Button>
            <Button type="submit" form="customer-form" disabled={saving} loading={saving}>
              <Save size={16} />
              {saving ? "Saving..." : "Update Customer"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !customer ? (
          <p className="text-muted">Customer not found.</p>
        ) : (
          <CustomerForm
            customer={customer}
            onSaved={() => {
              addToast("Customer updated successfully", "success")
              navigate(`/customers/${id}`)
            }}
            onSavingChange={setSaving}
          />
        )}
      </motion.div>
    </>
  )
}
