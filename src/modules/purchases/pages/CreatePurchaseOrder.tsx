"use client"

import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save, Send, AlertCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import PurchaseOrderForm, {
  type PurchaseOrderFormHandle,
} from "../components/PurchaseOrderForm"

export default function CreatePurchaseOrder() {
  const navigate = useNavigate()
  const formRef = useRef<PurchaseOrderFormHandle>(null)
  const [saving, setSaving] = useState<"Save" | "Submit" | null>(null)
  const [error, setError] = useState("")

  const handleSave = async (action: "Save" | "Submit") => {
    setSaving(action)
    setError("")
    try {
      const name = await formRef.current?.save(action)
      if (name) navigate(`/purchases/${encodeURIComponent(name)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save purchase order.")
    } finally {
      setSaving(null)
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
              onClick={() => navigate("/purchases")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">New Purchase Order</h1>
              <p className="text-sm text-muted mt-0.5">Create a new purchase order for a supplier.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/purchases")}>Cancel</Button>
            <Button variant="outline" onClick={() => handleSave("Save")} loading={saving === "Save"} disabled={!!saving}>
              <Save size={16} />
              {saving === "Save" ? "Saving…" : "Save Draft"}
            </Button>
            <Button onClick={() => handleSave("Submit")} loading={saving === "Submit"} disabled={!!saving}>
              <Send size={16} />
              {saving === "Submit" ? "Submitting…" : "Save & Submit"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="whitespace-pre-line">{error}</p>
          </div>
        )}

        <PurchaseOrderForm ref={formRef} mode="create" />
      </motion.div>
    </>
  )
}