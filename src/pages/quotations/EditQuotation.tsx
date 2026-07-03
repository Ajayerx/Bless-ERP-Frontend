"use client"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton } from "@/components/ui"
import { quotationService, type Quotation } from "@/services"
import QuotationForm from "@/modules/quotations/QuotationForm"

export default function EditQuotation() {
  const { id } = useParams<{ id: string }>()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    quotationService.getById(id).then(setQuotation).catch(() => null).finally(() => setLoading(false))
  }, [id])

  if (loading) return <><Topbar /><div className="p-6 space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!quotation) return <><Topbar /><div className="p-6 text-center text-muted">Quotation not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <QuotationForm quotation={quotation} />
      </motion.div>
    </>
  )
}
