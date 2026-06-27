"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Building2, Calendar, Tag, CreditCard, FileText, CheckCircle2, Wallet, XCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { accountingService } from "@/services"
import type { Expense } from "@/modules/accounting/types"
import { formatCurrency, formatDate } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" }> = {
  draft: { label: "Draft", variant: "default" },
  pending: { label: "Pending", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
}

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    accountingService.getExpense(id).then(setExpense).finally(() => setLoading(false))
  }, [id])

  const handleUpdateStatus = async (status: Expense["status"]) => {
    if (!id) return
    const updated = await accountingService.updateExpense(id, { status } as any)
    setExpense(updated)
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-[16px]" />)}
          </div>
          <Skeleton className="h-48 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!expense) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Expense not found.</p>
          <Button className="mt-4" onClick={() => navigate("/accounting/expenses")}>Back to Expenses</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/accounting/expenses")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{expense.number}</h1>
                <Badge variant={statusConfig[expense.status]?.variant ?? "default"}>
                  {statusConfig[expense.status]?.label ?? expense.status}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">{expense.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {expense.status === "draft" && (
              <>
                <Button variant="secondary" onClick={() => handleUpdateStatus("draft")} disabled><XCircle size={14} /> Cancel</Button>
                <Button onClick={() => handleUpdateStatus("pending")}><FileText size={14} /> Submit</Button>
              </>
            )}
            {expense.status === "pending" && (
              <Button onClick={() => handleUpdateStatus("paid")}><CheckCircle2 size={14} /> Mark Paid</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-danger-600 bg-danger-50"><Wallet size={20} /></div>
              <div>
                <p className="text-sm text-muted">Total Amount</p>
                <p className="text-xl font-bold text-heading tabular-nums">{formatCurrency(expense.total)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-primary-600 bg-primary-50"><Tag size={20} /></div>
              <div>
                <p className="text-sm text-muted">Category</p>
                <p className="text-lg font-semibold text-heading">{expense.category}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-success-600 bg-success-50"><CreditCard size={20} /></div>
              <div>
                <p className="text-sm text-muted">Payment Method</p>
                <p className="text-lg font-semibold text-heading">{expense.paymentMethod}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Row icon={Building2} label="Vendor" value={expense.vendorName} />
              <Row icon={Calendar} label="Date" value={formatDate(expense.date)} />
              <Row icon={Tag} label="Category" value={expense.category} />
              <Row icon={CreditCard} label="Payment Method" value={expense.paymentMethod} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Amount Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold text-heading tabular-nums">{formatCurrency(expense.amount)}</span>
              </div>
              {expense.taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Tax</span>
                  <span className="text-body tabular-nums">{formatCurrency(expense.taxAmount)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-base">
                <span className="font-bold text-heading">Total</span>
                <span className="font-bold text-heading tabular-nums">{formatCurrency(expense.total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {expense.notes && (
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-body">{expense.notes}</p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </>
  )
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={16} className="text-muted shrink-0" />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-semibold text-heading">{value}</p>
      </div>
    </div>
  )
}
