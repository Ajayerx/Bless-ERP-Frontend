"use client"

import { Package, AlertTriangle, DollarSign, XCircle } from "lucide-react"
import { Card, CardContent, Badge } from "@/components/ui"
import { type InventoryReport } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

interface InventoryReportProps {
  report: InventoryReport
}

export default function InventoryReportComponent({ report }: InventoryReportProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><Package size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Products</p>
                <p className="text-xl font-bold text-heading mt-1">{report.totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center shrink-0"><DollarSign size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Inventory Value</p>
                <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(report.totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0"><AlertTriangle size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Low Stock</p>
                <p className="text-xl font-bold text-heading mt-1">{report.lowStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-danger-50 text-danger-600 flex items-center justify-center shrink-0"><XCircle size={16} /></div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Out of Stock</p>
                <p className="text-xl font-bold text-heading mt-1">{report.outOfStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h3 className="font-bold text-heading mb-3">Stock Levels</h3>
          <div className="space-y-2">
            {report.items.map((item) => {
              const isLow = item.stock <= item.reorderLevel
              return (
                <div key={item.sku} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-heading text-sm">{item.productName}</p>
                      {isLow && <Badge variant="danger" className="px-1.5 py-0.5 text-[10px]">Low</Badge>}
                    </div>
                    <p className="text-xs text-muted">SKU: {item.sku}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className={cn("font-semibold tabular-nums text-sm", isLow ? "text-danger-600" : "text-heading")}>
                        {item.stock} units
                      </p>
                      <p className="text-xs text-muted">Reorder at {item.reorderLevel}</p>
                    </div>
                    <span className="font-semibold tabular-nums text-heading text-sm w-24 text-right">{formatCurrency(item.value)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
