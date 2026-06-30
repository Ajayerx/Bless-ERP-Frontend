"use client"

import { TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react"
import { Card, CardContent } from "@/components/ui"
import { type ProfitLoss } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

interface ProfitLossProps {
  report: ProfitLoss
}

const expenseLabels: Record<string, string> = {
  costOfGoodsSold: "Cost of Goods Sold",
  rent: "Rent",
  salaries: "Salaries",
  utilities: "Utilities",
  insurance: "Insurance",
  professionalServices: "Professional Services",
  shipping: "Shipping",
  marketing: "Marketing",
  officeSupplies: "Office Supplies",
  internet: "Internet & Telecom",
  vehicle: "Vehicle",
  depreciation: "Depreciation",
  other: "Other",
}

export default function ProfitLossComponent({ report }: ProfitLossProps) {
  const { income, expenses, netProfit, netMargin } = report
  const expenseItems = Object.entries(expenses).filter(([k]) => k !== "totalExpenses")

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center shrink-0"><TrendingUp size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Revenue</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(income.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-danger-50 text-danger-600 flex items-center justify-center shrink-0"><TrendingDown size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Expenses</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(expenses.totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><DollarSign size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Net Profit</p>
                <p className={cn("text-xl font-bold mt-1 tabular-nums", netProfit >= 0 ? "text-success-600" : "text-danger-600")}>
                  {formatCurrency(netProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-info-50 text-info-600 flex items-center justify-center shrink-0"><Percent size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Net Margin</p>
                <p className={cn("text-xl font-bold mt-1", netMargin >= 0 ? "text-success-600" : "text-danger-600")}>
                  {netMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <h3 className="font-bold text-heading mb-3">Income</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between py-1.5"><span className="text-sm text-muted">Sales Revenue</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(income.salesRevenue)}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-sm text-muted">Other Income</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(income.otherIncome)}</span></div>
              <div className="flex justify-between pt-2 border-t border-gray-200"><span className="font-bold text-heading">Total Income</span><span className="font-bold tabular-nums text-heading">{formatCurrency(income.totalRevenue)}</span></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h3 className="font-bold text-heading mb-3">Expenses</h3>
            <div className="space-y-1.5">
              {expenseItems.map(([key, value]) => (
                <div key={key} className="flex justify-between py-1">
                  <span className="text-sm text-muted">{expenseLabels[key] ?? key}</span>
                  <span className="font-semibold tabular-nums text-heading">{formatCurrency(value)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-gray-200"><span className="font-bold text-heading">Total Expenses</span><span className="font-bold tabular-nums text-heading">{formatCurrency(expenses.totalExpenses)}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
