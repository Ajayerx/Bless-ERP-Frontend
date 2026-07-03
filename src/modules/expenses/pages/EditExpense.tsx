"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Input, Select, Textarea, Link } from "@/components/ui"
import { useForm } from "react-hook-form"
import { expenseService, type ExpenseFormData } from "@/services"
import { EXPENSE_CATEGORIES } from "@/config/tax.config"

export default function EditExpense() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [expense, setExpense] = useState<ExpenseFormData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExpenseFormData>()

  useEffect(() => {
    if (!id) return
    expenseService.getById(id).then((d) => {
      const formData: ExpenseFormData = {
        description: d.description,
        category: d.category,
        amount: d.amount,
        date: d.date,
        paymentMethod: d.paymentMethod,
        supplier: d.supplier,
        notes: d.notes,
      }
      setExpense(formData)
      reset(formData)
    }).catch(() => null).finally(() => setLoading(false))
  }, [id, reset])

  const onSubmit = async (data: ExpenseFormData) => {
    if (!id) return
    setSaving(true)
    try {
      await expenseService.update(id, data)
      navigate(`/expenses/${id}`)
    } finally { setSaving(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!expense) return <><Topbar /><div className="p-6 text-center text-muted">Expense not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/expenses/${id}`}><ArrowLeft size={18} /><span>Back</span></Link>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">Edit Expense</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Input label="Description" {...register("description", { required: "Required" })} error={errors.description?.message} />
              </div>
              <Select label="Category" {...register("category")}>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </Select>
              <Input label="Amount ($)" type="number" step="0.01" {...register("amount", { valueAsNumber: true, required: "Required" })} error={errors.amount?.message} />
              <Input label="Date" type="date" {...register("date", { required: "Required" })} error={errors.date?.message} />
              <Select label="Payment Method" {...register("paymentMethod")}>
                <option value="credit_card">Credit Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Cheque</option>
                <option value="cash">Cash</option>
              </Select>
              <Input label="Supplier" {...register("supplier")} />
              <div className="col-span-2">
                <Textarea label="Notes" {...register("notes")} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="submit" loading={saving}>Save Expense</Button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
