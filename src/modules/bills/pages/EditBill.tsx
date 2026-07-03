"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Input, Select, Textarea, Link } from "@/components/ui"
import { useForm } from "react-hook-form"
import { billService, type Bill } from "@/services"

export default function EditBill() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [bill, setBill] = useState<Bill | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Bill>()

  useEffect(() => {
    if (!id) return
    billService.getById(id).then((d) => { setBill(d); reset(d) }).catch(() => null).finally(() => setLoading(false))
  }, [id, reset])

  const onSubmit = async (data: Bill) => {
    if (!id) return
    setSaving(true)
    try {
      await billService.update(id, data)
      navigate(`/bills/${id}`)
    } finally { setSaving(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!bill) return <><Topbar /><div className="p-6 text-center text-muted">Bill not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/bills/${id}`}><ArrowLeft size={18} /><span>Back</span></Link>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">Edit Bill</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Supplier Name" {...register("supplierName", { required: "Required" })} error={errors.supplierName?.message} />
              <Input label="Amount ($)" type="number" {...register("amount", { valueAsNumber: true, required: "Required" })} error={errors.amount?.message} />
              <Input label="Issue Date" type="date" {...register("issueDate", { required: "Required" })} error={errors.issueDate?.message} />
              <Input label="Due Date" type="date" {...register("dueDate", { required: "Required" })} error={errors.dueDate?.message} />
              <Select label="Status" {...register("status")}>
                <option value="received">Received</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </Select>
              <Input label="Category" {...register("category")} />
            </div>
            <Textarea label="Notes" {...register("notes")} />
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="submit" loading={saving}>Save Bill</Button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
