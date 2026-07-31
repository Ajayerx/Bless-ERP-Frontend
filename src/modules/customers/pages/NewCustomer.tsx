"use client"

import { useNavigate, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import CustomerForm from "../components/CustomerForm"
export default function NewCustomer() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as Record<string, unknown> | null

  const initialValues: Partial<import("@/services").CustomerFormData> | undefined =
    state?.customer_name
      ? {
          customer_name: state.customer_name as string,
          customer_type: (state.customer_type as string) || undefined,
          customer_group: (state.customer_group as string) || undefined,
          territory: (state.territory as string) || undefined,
          contactFirstName: (state.contactFirstName as string) || undefined,
          contactLastName: (state.contactLastName as string) || undefined,
          contactEmail: (state.contactEmail as string) || undefined,
          contactPhone: (state.contactPhone as string) || undefined,
          billingAddress: state.billingAddress as import("@/services").AddressInput | undefined,
        }
      : undefined

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
              onClick={() => navigate("/customers")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">New Customer</h1>
              <p className="text-sm text-muted mt-0.5">Add a new customer to your directory.</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate("/customers")}>
            Cancel
          </Button>
        </div>

        <div className="bg-surface rounded-[16px] border border-border shadow-card p-6">
          <CustomerForm
            initialValues={initialValues}
            onSaved={() => navigate("/customers")}
            onCancel={() => navigate("/customers")}
          />
        </div>
      </motion.div>
    </>
  )
}
