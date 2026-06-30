"use client"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Input, Select, Textarea, Link } from "@/components/ui"
import { useForm } from "react-hook-form"
import { billService } from "@/services"

interface FormData {
  supplierId: string
  supplierName: string
  amount: number
  issueDate: string
  dueDate: string
  category: string
  notes: string
}

export default function CreateBill() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>()

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await billService.create({ ...data, status: "received" })
      navigate(`/bills/${res.id}`)
    } finally { setLoading(false) }
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-6">
          <Link to="/bills"><ArrowLeft size={18} /><span>Back to Bills</span></Link>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">Create Bill</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Supplier Name" {...register("supplierName", { required: "Required" })} error={errors.supplierName?.message} />
              <Input label="Amount ($)" type="number" {...register("amount", { valueAsNumber: true, required: "Required" })} error={errors.amount?.message} />
              <Input label="Issue Date" type="date" {...register("issueDate", { required: "Required" })} error={errors.issueDate?.message} />
              <Input label="Due Date" type="date" {...register("dueDate", { required: "Required" })} error={errors.dueDate?.message} />
              <Input label="Category" {...register("category")} />
            </div>
            <Textarea label="Notes" {...register("notes")} />
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="submit" loading={loading}>Create Bill</Button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
