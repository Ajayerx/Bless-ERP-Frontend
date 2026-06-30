"use client"

import { Building2, CreditCard, PiggyBank } from "lucide-react"
import { Card, CardContent } from "@/components/ui"
import { type BalanceSheet } from "@/services"
import { formatCurrency } from "@/lib/utils"

interface BalanceSheetProps {
  report: BalanceSheet
}

export default function BalanceSheetComponent({ report }: BalanceSheetProps) {
  const { assets, liabilities, equity } = report

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center shrink-0"><Building2 size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Assets</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(assets.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-danger-50 text-danger-600 flex items-center justify-center shrink-0"><CreditCard size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Liabilities</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(liabilities.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><PiggyBank size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Equity</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(equity.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent>
            <h3 className="font-bold text-heading mb-3">Assets</h3>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mt-3 mb-1">Current Assets</p>
              {Object.entries(assets.currentAssets).filter(([k]) => k !== "total").map(([k, v]) => (
                <div key={k} className="flex justify-between py-1"><span className="text-sm text-muted capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(v)}</span></div>
              ))}
              <div className="flex justify-between py-1 border-t border-gray-100"><span className="text-sm font-semibold text-muted">Total Current</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(assets.currentAssets.total)}</span></div>

              <p className="text-xs font-semibold text-muted uppercase tracking-wider mt-3 mb-1">Fixed Assets</p>
              {Object.entries(assets.fixedAssets).filter(([k]) => k !== "total").map(([k, v]) => (
                <div key={k} className="flex justify-between py-1"><span className="text-sm text-muted capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(v)}</span></div>
              ))}
              <div className="flex justify-between py-1 border-t border-gray-100"><span className="text-sm font-semibold text-muted">Total Fixed</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(assets.fixedAssets.total)}</span></div>

              <p className="text-xs font-semibold text-muted uppercase tracking-wider mt-3 mb-1">Other Assets</p>
              {Object.entries(assets.otherAssets).filter(([k]) => k !== "total").map(([k, v]) => (
                <div key={k} className="flex justify-between py-1"><span className="text-sm text-muted capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(v)}</span></div>
              ))}
              <div className="flex justify-between py-1 border-t border-gray-200 mt-2">
                <span className="font-bold text-heading">Total Assets</span>
                <span className="font-bold tabular-nums text-heading">{formatCurrency(assets.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h3 className="font-bold text-heading mb-3">Liabilities</h3>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mt-3 mb-1">Current</p>
              {Object.entries(liabilities.currentLiabilities).filter(([k]) => k !== "total").map(([k, v]) => (
                <div key={k} className="flex justify-between py-1"><span className="text-sm text-muted capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(v)}</span></div>
              ))}
              <div className="flex justify-between py-1 border-t border-gray-100"><span className="text-sm font-semibold text-muted">Total Current</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(liabilities.currentLiabilities.total)}</span></div>

              <p className="text-xs font-semibold text-muted uppercase tracking-wider mt-3 mb-1">Long-term</p>
              {Object.entries(liabilities.longTermLiabilities).filter(([k]) => k !== "total").map(([k, v]) => (
                <div key={k} className="flex justify-between py-1"><span className="text-sm text-muted capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(v)}</span></div>
              ))}
              <div className="flex justify-between py-1 border-t border-gray-200 mt-2">
                <span className="font-bold text-heading">Total Liabilities</span>
                <span className="font-bold tabular-nums text-heading">{formatCurrency(liabilities.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h3 className="font-bold text-heading mb-3">Equity</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between py-1"><span className="text-sm text-muted">Retained Earnings</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(equity.retainedEarnings)}</span></div>
              <div className="flex justify-between py-1"><span className="text-sm text-muted">Current Earnings</span><span className="font-semibold tabular-nums text-heading">{formatCurrency(equity.currentEarnings)}</span></div>
              <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                <span className="font-bold text-heading">Total Equity</span>
                <span className="font-bold tabular-nums text-heading">{formatCurrency(equity.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
