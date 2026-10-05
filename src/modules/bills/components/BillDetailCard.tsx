"use client"

import { Receipt, Calendar, Wallet, Clock, ChevronDown } from "lucide-react"
import { Card, CardContent, Badge } from "@/components/ui"
import { getPurchaseInvoiceIndicator, type PurchaseInvoiceDoc } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

const dnum = (v: unknown): number => (typeof v === "number" && !Number.isNaN(v) ? v : 0)

const rowCls = "grid grid-cols-1 md:grid-cols-3 gap-4"
const statCls = "flex items-start gap-3"

interface BillDetailCardProps {
  bill: PurchaseInvoiceDoc
}

export default function BillDetailCard({ bill }: BillDetailCardProps) {
  const status = getPurchaseInvoiceIndicator({
    docstatus: dnum(bill.docstatus),
    outstanding_amount: dnum(bill.outstanding_amount),
    paid_amount: dnum(bill.paid_amount),
    due_date: bill.due_date,
  })

  const items = Array.isArray(bill.items) ? bill.items : []
  const taxes = Array.isArray(bill.taxes) ? bill.taxes : []
  const currency = bill.currency || "CAD"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-[12px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
            <Receipt size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-heading">{bill.name}</h1>
            <p className="text-sm text-muted">{bill.supplier_name || bill.supplier}</p>
          </div>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className={statCls}>
              <div className="p-2 rounded-[10px] bg-primary-50 text-primary-600 shrink-0">
                <Receipt size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Grand Total</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{formatCurrency(dnum(bill.grand_total), currency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className={statCls}>
              <div className="p-2 rounded-[10px] bg-info-50 text-info-600 shrink-0">
                <Wallet size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Outstanding</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{formatCurrency(dnum(bill.outstanding_amount), currency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className={statCls}>
              <div className="p-2 rounded-[10px] bg-success-50 text-success-600 shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Paid</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{formatCurrency(dnum(bill.paid_amount), currency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className={statCls}>
              <div className="p-2 rounded-[10px] bg-warning-50 text-warning-600 shrink-0">
                <Calendar size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Tax</p>
                <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{formatCurrency(dnum(bill.total_taxes_and_charges), currency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={rowCls}>
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-bold text-heading text-sm">Supplier</h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-muted text-xs">Name</p>
                <p className="font-semibold text-heading">{bill.supplier_name || bill.supplier}</p>
              </div>
              <div>
                <p className="text-muted text-xs">Supplier ID</p>
                <p className="font-semibold text-heading">{bill.supplier}</p>
              </div>
              <div>
                <p className="text-muted text-xs">Purchase Order</p>
                <p className="font-semibold text-heading">{bill.purchase_order || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-bold text-heading text-sm">Bill Dates</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-muted" />
                <div>
                  <p className="text-muted text-xs">Posting Date</p>
                  <p className="font-semibold text-heading">{formatDate(bill.posting_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Wallet size={14} className="text-muted" />
                <div>
                  <p className="text-muted text-xs">Due Date</p>
                  <p className="font-semibold text-heading">{formatDate(bill.due_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-muted" />
                <div>
                  <p className="text-muted text-xs">Created</p>
                  <p className="font-semibold text-heading">{bill.creation ? formatDate(bill.creation) : "—"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-bold text-heading text-sm">Company</h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-muted text-xs">Company</p>
                <p className="font-semibold text-heading">{bill.company}</p>
              </div>
              <div>
                <p className="text-muted text-xs">Currency</p>
                <p className="font-semibold text-heading">{bill.currency}</p>
              </div>
              <div>
                <p className="text-muted text-xs">Cost Center</p>
                <p className="font-semibold text-heading">{bill.cost_center || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-heading">Items ({items.length})</h3>
            <ChevronDown size={15} className="text-muted" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="py-2 pr-3 font-semibold">Item</th>
                  <th className="py-2 pr-3 font-semibold">Description</th>
                  <th className="py-2 pr-3 font-semibold text-right">Qty / Rate</th>
                  <th className="py-2 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.name ?? idx} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 font-semibold text-heading whitespace-nowrap">{item.item_code}</td>
                    <td className="py-2.5 pr-3 text-body">{item.item_name}</td>
                    <td className="py-2.5 pr-3 text-right text-muted whitespace-nowrap">
                      {dnum(item.qty)} × {formatCurrency(dnum(item.rate), currency)}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-heading tabular-nums whitespace-nowrap">
                      {formatCurrency(dnum(item.amount), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-bold text-heading text-sm">Taxes & Charges</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="py-2 pr-3 font-semibold">Charge</th>
                    <th className="py-2 pr-3 font-semibold">Account</th>
                    <th className="py-2 pr-3 font-semibold text-right">Rate</th>
                    <th className="py-2 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {taxes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-muted text-center">No taxes applied</td>
                    </tr>
                  )}
                  {taxes.map((tax, idx) => (
                    <tr key={tax.name ?? idx} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3 font-semibold text-heading">{tax.description || tax.charge_type}</td>
                      <td className="py-2.5 pr-3 text-body">{tax.account_head}</td>
                      <td className="py-2.5 pr-3 text-right text-muted tabular-nums">{dnum(tax.rate)}%</td>
                      <td className="py-2.5 text-right font-semibold text-heading tabular-nums">
                        {formatCurrency(dnum(tax.tax_amount), currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-bold text-heading text-sm">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Total Quantity</span>
                <span className="font-semibold text-heading">{dnum(bill.total_qty)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Net Total</span>
                <span className="font-semibold text-heading tabular-nums">{formatCurrency(dnum(bill.net_total), currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Taxes & Charges</span>
                <span className="font-semibold text-heading tabular-nums">{formatCurrency(dnum(bill.total_taxes_and_charges), currency)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-bold text-heading">Grand Total</span>
                <span className="font-bold text-heading tabular-nums">{formatCurrency(dnum(bill.grand_total), currency)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-bold text-heading">Outstanding</span>
                <span className="font-bold text-danger-600 tabular-nums">{formatCurrency(dnum(bill.outstanding_amount), currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}