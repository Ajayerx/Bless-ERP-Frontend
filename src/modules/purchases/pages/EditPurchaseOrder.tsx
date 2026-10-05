"use client"

import { useRef, useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save, AlertCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Skeleton } from "@/components/ui"
import { purchaseOrderService, type PurchaseOrderDoc } from "@/services"
import PurchaseOrderForm, {
  type PurchaseOrderFormHandle,
} from "../components/PurchaseOrderForm"

export default function EditPurchaseOrder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const formRef = useRef<PurchaseOrderFormHandle>(null)
  const [doc, setDoc] = useState<PurchaseOrderDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return
    setLoading(true)
    purchaseOrderService
      .getDoc(id)
      .then(setDoc)
      .catch(() => setDoc(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      const name = await formRef.current?.save("Save")
      if (name) navigate(`/purchases/${encodeURIComponent(name)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update purchase order.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/purchases/${id ? encodeURIComponent(id) : ""}`)}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">{id ? `Edit ${id}` : "Edit Purchase Order"}</h1>
              <p className="text-sm text-muted mt-0.5">Update the purchase order details.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate(`/purchases/${id ? encodeURIComponent(id) : ""}`)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save size={16} />
              {saving ? "Saving…" : "Update Purchase Order"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="whitespace-pre-line">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !doc ? (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>Purchase order not found.</p>
          </div>
        ) : (
          <PurchaseOrderForm ref={formRef} doc={doc} mode="edit" />
        )}
      </motion.div>
    </>
  )
}