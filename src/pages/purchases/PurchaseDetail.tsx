"use client"

import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Pencil } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button } from "@/components/ui"
import { purchaseOrderService, type PurchaseOrder } from "@/services"
import PurchaseDetailCard from "@/modules/invoices/PurchaseDetailCard"

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    purchaseOrderService.getById(id).then(setPurchaseOrder).catch(() => null).finally(() => setLoading(false))
  }, [id])

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-4xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !purchaseOrder ? (
          <p className="text-muted">Purchase order not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Link to="/purchases" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body transition-colors">
                <ArrowLeft size={16} /> Back to Purchases
              </Link>
              <Button variant="outline" size="sm" onClick={() => navigate(`/purchases/${id}/edit`)}>
                <Pencil size={14} /> Edit
              </Button>
            </div>
            <PurchaseDetailCard purchaseOrder={purchaseOrder} />
          </div>
        )}
      </motion.div>
    </>
  )
}
