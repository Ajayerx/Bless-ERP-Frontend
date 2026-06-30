"use client"

import { TrendingUp, DollarSign, BarChart3, ShoppingCart, Users, Package } from "lucide-react"
import { Card, CardContent } from "@/components/ui"
import { type SalesReport } from "@/services"
import { formatCurrency } from "@/lib/utils"

interface SalesReportProps {
  report: SalesReport
}

export default function SalesReportComponent({ report }: SalesReportProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center shrink-0"><DollarSign size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Sales</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(report.totalSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><ShoppingCart size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Orders</p>
                <p className="text-xl font-bold text-heading mt-1">{report.totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0"><BarChart3 size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Avg Order Value</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(report.averageOrderValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-info-50 text-info-600 flex items-center justify-center shrink-0"><TrendingUp size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Monthly Target</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(report.monthlyTrend[report.monthlyTrend.length - 1]?.target ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <h3 className="font-bold text-heading mb-3 flex items-center gap-2"><Users size={16} />Sales by Customer</h3>
            <div className="space-y-2">
              {report.salesByCustomer.map((c) => (
                <div key={c.customerName} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-semibold text-heading text-sm">{c.customerName}</p>
                    <p className="text-xs text-muted">{c.orders} orders</p>
                  </div>
                  <span className="font-semibold tabular-nums text-heading text-sm">{formatCurrency(c.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h3 className="font-bold text-heading mb-3 flex items-center gap-2"><Package size={16} />Sales by Product</h3>
            <div className="space-y-2">
              {report.salesByProduct.map((p) => (
                <div key={p.productName} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-semibold text-heading text-sm">{p.productName}</p>
                    <p className="text-xs text-muted">{p.qty} units</p>
                  </div>
                  <span className="font-semibold tabular-nums text-heading text-sm">{formatCurrency(p.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h3 className="font-bold text-heading mb-3 flex items-center gap-2"><TrendingUp size={16} />Monthly Trend</h3>
          <div className="space-y-2">
            {report.monthlyTrend.map((m) => (
              <div key={m.month} className="flex items-center gap-4 py-1.5 border-b border-gray-50 last:border-0">
                <span className="font-semibold text-heading text-sm w-10">{m.month}</span>
                <div className="flex-1 h-5 rounded-[6px] bg-gray-100 overflow-hidden relative">
                  <div className="h-full bg-primary-500 rounded-[6px] transition-all" style={{ width: `${Math.min((m.sales / Math.max(...report.monthlyTrend.map((x) => x.sales))) * 100, 100)}%` }} />
                </div>
                <div className="text-right w-28">
                  <span className="font-semibold tabular-nums text-heading text-sm">{formatCurrency(m.sales)}</span>
                  <span className="text-xs text-muted ml-2">/ {formatCurrency(m.target)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
