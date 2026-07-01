"use client"

import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Pencil } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button } from "@/components/ui"
import { supplierService, type Supplier } from "@/services"
import SupplierDetailCard from "@/modules/suppliers/SupplierDetailCard"

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    supplierService.getById(id).then(setSupplier).catch(() => null).finally(() => setLoading(false))
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
        ) : !supplier ? (
          <p className="text-muted">Supplier not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Link to="/suppliers" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body transition-colors">
                <ArrowLeft size={16} /> Back to Suppliers
              </Link>
              <Button variant="outline" size="sm" onClick={() => navigate(`/suppliers/${id}/edit`)}>
                <Pencil size={14} /> Edit
              </Button>
            </div>
            <SupplierDetailCard supplier={supplier} />
          </div>
        )}
      </motion.div>
    </>
  )
}
