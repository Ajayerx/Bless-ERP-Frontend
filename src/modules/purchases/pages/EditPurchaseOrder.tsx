"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Input, Select, Textarea, Link } from "@/components/ui"
import { useForm } from "react-hook-form"
import { purchaseOrderService, type PurchaseOrder } from "@/services"

export default function EditPurchaseOrder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PurchaseOrder>()

  useEffect(() => {
    if (!id) return
    purchaseOrderService.getById(id).then((d) => { setPo(d); reset(d) }).catch(() => null).finally(() => setLoading(false))
  }, [id, reset])

  const onSubmit = async (data: PurchaseOrder) => {
    if (!id) return
    setSaving(true)
    try {
      await purchaseOrderService.update(id, data)
      navigate(`/purchases/${id}`)
    } finally { setSaving(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!po) return <><Topbar /><div className="p-6 text-center text-muted">Purchase order not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/purchases/${id}`}><ArrowLeft size={18} /><span>Back</span></Link>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">Edit Purchase Order</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Supplier Name" {...register("supplierName", { required: "Required" })} error={errors.supplierName?.message} />
              <Input label="Total ($)" type="number" {...register("total", { valueAsNumber: true, required: "Required" })} error={errors.total?.message} />
              <Input label="Order Date" type="date" {...register("orderDate")} />
              <Input label="Expected Delivery" type="date" {...register("expectedDelivery")} />
              <Select label="Status" {...register("status")}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
            <Textarea label="Notes" {...register("notes")} />
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="submit" loading={saving}>Save Purchase Order</Button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
