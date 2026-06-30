"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { expenseService, type ExpenseListResponse } from "@/services"
import ExpenseTable from "@/modules/expenses/ExpenseTable"

export default function Expenses() {
  const navigate = useNavigate()
  const [data, setData] = useState<ExpenseListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await expenseService.list({ search, page, pageSize: 10 })
      setData(result)
    } finally { setLoading(false) }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Expenses</h1>
            <p className="text-sm text-muted mt-1">Track all business expenses.</p>
          </div>
          <Button onClick={() => navigate("/expenses/new")}><Plus size={16} /> Add Expense</Button>
        </div>
        <ExpenseTable
          data={data} loading={loading} search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page} onPageChange={setPage}
          onRowClick={(expense) => navigate(`/expenses/${expense.id}`)}
        />
      </motion.div>
    </>
  )
}
