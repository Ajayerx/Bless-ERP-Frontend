"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Input, Textarea, Link } from "@/components/ui"
import { useForm } from "react-hook-form"
import { supplierService, type SupplierFormData } from "@/services"

export default function EditSupplier() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState<SupplierFormData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupplierFormData>()

  useEffect(() => {
    if (!id) return
    supplierService.getById(id).then((d) => {
      const formData: SupplierFormData = {
        name: d.name,
        contactName: d.contactName,
        email: d.email,
        phone: d.phone,
        billingAddress: d.billingAddress,
        taxId: d.taxId,
      }
      setSupplier(formData)
      reset(formData)
    }).catch(() => null).finally(() => setLoading(false))
  }, [id, reset])

  const onSubmit = async (data: SupplierFormData) => {
    if (!id) return
    setSaving(true)
    try {
      await supplierService.update(id, data)
      navigate(`/suppliers/${id}`)
    } finally { setSaving(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!supplier) return <><Topbar /><div className="p-6 text-center text-muted">Supplier not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/suppliers/${id}`}><ArrowLeft size={18} /><span>Back</span></Link>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">Edit Supplier</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Input label="Supplier Name" {...register("name", { required: "Required" })} error={errors.name?.message} />
              </div>
              <Input label="Contact Name" {...register("contactName")} />
              <Input label="Email" type="email" {...register("email", { required: "Required" })} error={errors.email?.message} />
              <Input label="Phone" {...register("phone")} />
              <Input label="Tax ID" {...register("taxId")} />
              <div className="col-span-2">
                <Textarea label="Billing Address" {...register("billingAddress")} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="submit" loading={saving}>Save Supplier</Button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
