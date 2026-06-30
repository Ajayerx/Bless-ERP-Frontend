"use client"

import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import ExpenseForm from "@/modules/expenses/ExpenseForm"

export default function NewExpense() {
  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6 max-w-3xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <ExpenseForm />
      </motion.div>
    </>
  )
}
