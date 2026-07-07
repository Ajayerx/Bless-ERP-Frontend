"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton } from "@/components/ui"
import { quotationService, type Quotation, type QuotationFormData } from "@/services"
import QuotationForm from "../components/QuotationForm"

export default function EditQuotation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    quotationService.getById(id).then(setQuotation).catch(() => null).finally(() => setLoading(false))
  }, [id])

  const onSubmit = async (data: QuotationFormData) => {
    if (!id) return
    setSaving(true)
    try {
      await quotationService.update(id, data)
      navigate(`/quotations/${id}`)
    } finally { setSaving(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!quotation) return <><Topbar /><div className="p-6 text-center text-muted">Quotation not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <QuotationForm quotation={quotation} onSubmit={onSubmit} loading={saving} />
      </motion.div>
    </>
  )
}
