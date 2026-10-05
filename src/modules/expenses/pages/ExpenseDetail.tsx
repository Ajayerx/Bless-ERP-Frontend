"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Pencil, Send, Undo2, CopyPlus, Trash2 } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button } from "@/components/ui"
import { expenseService, type Expense } from "@/services"
import ExpenseDetailCard from "../components/ExpenseDetailCard"

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<false | "submit" | "cancel" | "amend" | "delete">(false)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    expenseService.getById(id).then(setExpense).catch(() => null).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const run = async (action: "submit" | "cancel" | "amend" | "delete") => {
    if (!expense) return
    setError("")
    setBusy(action)
    try {
      if (action === "submit") {
        await expenseService.submit(expense.name)
      } else if (action === "cancel") {
        await expenseService.cancel(expense.name)
      } else if (action === "amend") {
        const doc = await expenseService.getDoc(expense.name)
        const amended = await expenseService.amend(doc)
        navigate(`/expenses/${amended.name}/edit`)
        return
      } else {
        await expenseService.delete(expense.name)
        navigate("/expenses")
        return
      }
      load()
    } catch {
      setError("Action failed. Refresh and try again.")
      setBusy(false)
    }
  }

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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link to="/expenses" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body transition-colors">
                <ArrowLeft size={16} /> Back to Expenses
              </Link>
              <div className="flex items-center gap-2">
                {expense.status === "draft" && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/expenses/${expense.id}/edit`)}>
                      <Pencil size={14} /> Edit
                    </Button>
                    <Button
                      size="sm" disabled={busy !== false} loading={busy === "submit"}
                      onClick={() => run("submit")}
                    >
                      <Send size={14} /> Submit
                    </Button>
                  </>
                )}
                {expense.status === "submitted" && (
                  <>
                    <Button
                      variant="outline" size="sm" disabled={busy !== false} loading={busy === "amend"}
                      onClick={() => run("amend")}
                    >
                      <CopyPlus size={14} /> Amend
                    </Button>
                    <Button
                      variant="outline" size="sm" disabled={busy !== false} loading={busy === "cancel"}
                      onClick={() => run("cancel")}
                    >
                      <Undo2 size={14} /> Cancel
                    </Button>
                  </>
                )}
                {expense.status === "draft" && (
                  <Button
                    variant="danger" size="sm" disabled={busy !== false} loading={busy === "delete"}
                    onClick={() => run("delete")}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                )}
              </div>
            </div>
            {error && <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[10px]">{error}</p>}
            <ExpenseDetailCard expense={expense} />
          </div>
        )}
      </motion.div>
    </>
  )
}