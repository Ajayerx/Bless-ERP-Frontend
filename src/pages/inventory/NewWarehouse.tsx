"use client"

import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import WarehouseForm from "@/modules/inventory/WarehouseForm"

export default function NewWarehouse() {
  const navigate = useNavigate()

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6 max-w-3xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/inventory/warehouses")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">New Warehouse</h1>
              <p className="text-sm text-muted mt-0.5">Add a new storage location.</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate("/inventory/warehouses")}>Cancel</Button>
        </div>

        <WarehouseForm onSaved={() => navigate("/inventory/warehouses")} onCancel={() => navigate("/inventory/warehouses")} />
      </motion.div>
    </>
  )
}
