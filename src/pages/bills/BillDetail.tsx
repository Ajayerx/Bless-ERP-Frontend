"use client"

import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Pencil } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button } from "@/components/ui"
import { billService, type Bill } from "@/services"
import BillDetailCard from "@/modules/bills/BillDetailCard"

export default function BillDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [bill, setBill] = useState<Bill | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    billService.getById(id).then(setBill).catch(() => null).finally(() => setLoading(false))
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
        ) : !bill ? (
          <p className="text-muted">Bill not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Link to="/bills" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body transition-colors">
                <ArrowLeft size={16} /> Back to Bills
              </Link>
              <Button variant="outline" size="sm" onClick={() => navigate(`/bills/${id}/edit`)}>
                <Pencil size={14} /> Edit
              </Button>
            </div>
            <BillDetailCard bill={bill} />
          </div>
        )}
      </motion.div>
    </>
  )
}
