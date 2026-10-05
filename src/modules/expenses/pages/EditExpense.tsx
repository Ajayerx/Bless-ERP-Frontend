"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Link } from "@/components/ui"
import { expenseService, type Expense } from "@/services"
import ExpenseForm from "../components/ExpenseForm"

export default function EditExpense() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    expenseService.getById(id)
      .then(setExpense)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
        </div>
      </>
    )
  }
  if (!expense) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center text-muted">Expense not found</div>
      </>
    )
  }
  if (expense.status !== "draft") {
    return (
      <>
        <Topbar />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Link to={`/expenses/${id}`}><ArrowLeft size={18} /><span>Back</span></Link>
          </div>
          <p className="text-sm text-muted">Only draft expenses can be edited. Cancel or amend this entry first.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to={`/expenses/${id}`}><ArrowLeft size={18} /><span>Back</span></Link>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/expenses/${id}`)}>Cancel</Button>
        </div>
        <ExpenseForm expense={expense} />
      </motion.div>
    </>
  )
}