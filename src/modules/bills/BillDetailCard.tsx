"use client"

import { FileText, Calendar, DollarSign, Tag } from "lucide-react"
import { Card, CardContent, Badge } from "@/components/ui"
import { type Bill } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

const statusVariant: Record<string, "success" | "warning" | "danger" | "info"> = {
  paid: "success",
  received: "info",
  overdue: "danger",
}

interface BillDetailCardProps {
  bill: Bill
}

export default function BillDetailCard({ bill }: BillDetailCardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-[12px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-heading">{bill.number}</h1>
            <p className="text-sm text-muted">{bill.supplierName}</p>
          </div>
        </div>
        <Badge variant={statusVariant[bill.status] ?? "info"}>
          {bill.status === "overdue" ? "Overdue" : bill.status === "received" ? "Received" : "Paid"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <DollarSign size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Amount</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(bill.amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Calendar size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Due Date</p>
                <p className="text-2xl font-bold text-heading mt-1">{formatDate(bill.dueDate)}</p>
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
                <p className="text-2xl font-bold text-heading mt-1">{bill.category}</p>
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
              <p className="text-muted">Issue Date</p>
              <p className="font-semibold text-heading">{formatDate(bill.issueDate)}</p>
            </div>
            <div>
              <p className="text-muted">Supplier</p>
              <p className="font-semibold text-heading">{bill.supplierName}</p>
            </div>
            <div>
              <p className="text-muted">Status</p>
              <p className="font-semibold text-heading">{bill.status === "overdue" ? "Overdue" : bill.status === "received" ? "Received" : "Paid"}</p>
            </div>
            <div>
              <p className="text-muted">Created</p>
              <p className="font-semibold text-heading">{formatDate(bill.createdAt)}</p>
            </div>
          </div>
          {bill.notes && (
            <div>
              <p className="text-muted text-sm">Notes</p>
              <p className="text-sm text-heading mt-0.5">{bill.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
