"use client"

import { useParams } from "react-router-dom"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import SupplierForm from "../components/SupplierForm"

export default function EditSupplier() {
  const { id } = useParams<{ id: string }>()
  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <SupplierForm supplierName={id} />
      </motion.div>
    </>
  )
}