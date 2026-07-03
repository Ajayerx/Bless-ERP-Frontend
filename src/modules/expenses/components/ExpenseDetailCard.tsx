"use client"

import { Wallet, Calendar, DollarSign, Tag, FileText, CreditCard } from "lucide-react"
import { Card, CardContent, Badge } from "@/components/ui"
import { type Expense } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

interface ExpenseDetailCardProps {
  expense: Expense
}

export default function ExpenseDetailCard({ expense }: ExpenseDetailCardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-[12px] bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Wallet size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-heading">{expense.description}</h1>
          <p className="text-sm text-muted">{expense.supplier}</p>
        </div>
        <Badge variant={expense.status === "paid" ? "success" : "warning"} className="ml-auto">
          {expense.status === "paid" ? "Paid" : "Unpaid"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <DollarSign size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Amount</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(expense.amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Calendar size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Date</p>
                <p className="text-2xl font-bold text-heading mt-1">{formatDate(expense.date)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Tag size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Category</p>
                <p className="text-2xl font-bold text-heading mt-1">{expense.category}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <h3 className="font-bold text-heading">Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted">Payment Method</p>
              <p className="font-semibold text-heading capitalize">{expense.paymentMethod.replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-muted">Supplier</p>
              <p className="font-semibold text-heading">{expense.supplier || "—"}</p>
            </div>
            <div>
              <p className="text-muted">Status</p>
              <p className="font-semibold text-heading">{expense.status === "paid" ? "Paid" : "Unpaid"}</p>
            </div>
            <div>
              <p className="text-muted">Created</p>
              <p className="font-semibold text-heading">{formatDate(expense.createdAt)}</p>
            </div>
          </div>
          {expense.notes && (
            <div>
              <p className="text-muted text-sm">Notes</p>
              <p className="text-sm text-heading mt-0.5">{expense.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
