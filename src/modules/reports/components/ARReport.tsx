"use client"

import { Clock, AlertTriangle, DollarSign, Users, TrendingUp } from "lucide-react"
import { Card, CardContent, Badge } from "@/components/ui"
import { type ARReport } from "@/services"
import { formatCurrency } from "@/lib/utils"

interface ARReportProps {
  report: ARReport
}

const bucketLabels: Record<string, string> = {
  current: "Current (0–30 days)",
  days1to30: "1–30 Days",
  days31to60: "31–60 Days",
  days61to90: "61–90 Days",
  days90plus: "90+ Days",
}

const bucketColors: Record<string, string> = {
  current: "bg-success-500",
  days1to30: "bg-warning-400",
  days31to60: "bg-warning-500",
  days61to90: "bg-danger-400",
  days90plus: "bg-danger-600",
}

export default function ARReportComponent({ report }: ARReportProps) {
  const maxBucket = Math.max(...Object.values(report.agingBuckets))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-danger-50 text-danger-600 flex items-center justify-center shrink-0"><DollarSign size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Outstanding</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(report.totalOutstanding)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0"><TrendingUp size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Overdue (31–60d)</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(report.agingBuckets.days31to60)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-danger-50 text-danger-600 flex items-center justify-center shrink-0"><AlertTriangle size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">90+ Days</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(report.agingBuckets.days90plus)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-info-50 text-info-600 flex items-center justify-center shrink-0"><Users size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Customers</p>
                <p className="text-xl font-bold text-heading mt-1">{report.customers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h3 className="font-bold text-heading mb-3 flex items-center gap-2"><Clock size={16} />Aging Summary</h3>
          <div className="space-y-2">
            {Object.entries(report.agingBuckets).map(([key, value]) => (
              <div key={key} className="flex items-center gap-4 py-1">
                <span className="text-sm font-semibold text-heading w-36">{bucketLabels[key] ?? key}</span>
                <div className="flex-1 h-5 rounded-[6px] bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-[6px] transition-all ${bucketColors[key] ?? "bg-primary-500"}`}
                    style={{ width: `${(value / maxBucket) * 100}%` }} />
                </div>
                <span className="font-semibold tabular-nums text-heading text-sm w-28 text-right">{formatCurrency(value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="font-bold text-heading mb-3">Customer Breakdown</h3>
          <div className="space-y-2">
            {report.customers.map((c) => (
              <div key={c.customerName} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-semibold text-heading text-sm">{c.customerName}</p>
                  <p className="text-xs text-muted">{c.daysOverdue > 0 ? `${c.daysOverdue} days overdue` : "Current"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums text-heading text-sm">{formatCurrency(c.outstanding)}</span>
                  <Badge variant={c.status === "overdue" ? "danger" : c.status === "current" ? "success" : "warning"}>
                    {c.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
