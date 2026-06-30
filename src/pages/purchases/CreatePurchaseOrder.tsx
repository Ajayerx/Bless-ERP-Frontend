"use client"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Input, Textarea, Link } from "@/components/ui"
import { useForm } from "react-hook-form"
import { purchaseOrderService } from "@/services"

interface FormData {
  supplierName: string
  total: number
  orderDate: string
  expectedDelivery: string
  notes: string
}

export default function CreatePurchaseOrder() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>()

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await purchaseOrderService.create({ ...data, status: "draft" })
      navigate(`/purchases/${res.id}`)
    } finally { setLoading(false) }
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-6">
          <Link to="/purchases"><ArrowLeft size={18} /><span>Back to Purchases</span></Link>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">Create Purchase Order</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Supplier Name" {...register("supplierName", { required: "Required" })} error={errors.supplierName?.message} />
              <Input label="Total ($)" type="number" {...register("total", { valueAsNumber: true, required: "Required" })} error={errors.total?.message} />
              <Input label="Order Date" type="date" {...register("orderDate", { required: "Required" })} error={errors.orderDate?.message} />
              <Input label="Expected Delivery" type="date" {...register("expectedDelivery")} />
            </div>
            <Textarea label="Notes" {...register("notes")} />
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="submit" loading={loading}>Create Purchase Order</Button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
