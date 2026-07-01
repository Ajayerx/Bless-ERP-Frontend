"use client"

import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Pencil } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button } from "@/components/ui"
import { expenseService, type Expense } from "@/services"
import ExpenseDetailCard from "@/modules/expenses/ExpenseDetailCard"

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    expenseService.getById(id).then(setExpense).catch(() => null).finally(() => setLoading(false))
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
        ) : !expense ? (
          <p className="text-muted">Expense not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Link to="/expenses" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body transition-colors">
                <ArrowLeft size={16} /> Back to Expenses
              </Link>
              <Button variant="outline" size="sm" onClick={() => navigate(`/expenses/${id}/edit`)}>
                <Pencil size={14} /> Edit
              </Button>
            </div>
            <ExpenseDetailCard expense={expense} />
          </div>
        )}
      </motion.div>
    </>
  )
}
