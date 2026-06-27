"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { DollarSign, FileText, CheckCircle2, Banknote, CreditCard } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { paymentService, type Invoice, type Payment, type PaymentListResponse } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

const methodIcons: Record<string, React.ReactNode> = {
  bank_transfer: <Banknote size={14} />,
  credit_card: <CreditCard size={14} />,
  check: <FileText size={14} />,
  cash: <DollarSign size={14} />,
}

const methodLabels: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  credit_card: "Credit Card",
  check: "Check",
  cash: "Cash",
}

export default function Payments() {
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([])
  const [paymentsData, setPaymentsData] = useState<PaymentListResponse | null>(null)
  const [loadingUnpaid, setLoadingUnpaid] = useState(true)
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [paymentPage, setPaymentPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoadingUnpaid(true)
    setLoadingPayments(true)
    try {
      const [unpaid, paid] = await Promise.all([
        paymentService.getUnpaidInvoices(),
        paymentService.list({ page: paymentPage, pageSize: 10 }),
      ])
      setUnpaidInvoices(unpaid)
      setPaymentsData(paid)
    } finally {
      setLoadingUnpaid(false)
      setLoadingPayments(false)
    }
  }, [paymentPage])

  useEffect(() => { fetchData() }, [fetchData])

  const paymentColumns: Column<Payment>[] = [
    {
      key: "customerName",
      header: "Customer",
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center">
            <CheckCircle2 size={15} />
          </div>
          <div>
            <p className="font-semibold text-heading">{p.customerName}</p>
            <p className="text-xs text-muted">{p.invoiceNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (p) => (
        <span className="font-semibold tabular-nums text-heading">{formatCurrency(p.amount)}</span>
      ),
    },
    {
      key: "paymentMethod",
      header: "Method",
      hideOnMobile: true,
      render: (p) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted">
          {methodIcons[p.paymentMethod]}
          {methodLabels[p.paymentMethod]}
        </span>
      ),
    },
    {
      key: "paymentDate",
      header: "Date",
      hideOnMobile: true,
      render: (p) => (
        <span className="text-sm text-muted">{formatDate(p.paymentDate)}</span>
      ),
    },
  ]

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-heading">Payments</h1>
          <p className="text-sm text-muted mt-1">Record payments against invoices and view payment history.</p>
        </div>

        {/* Unpaid Invoices */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-heading">Unpaid Invoices</h2>
            {unpaidInvoices.length > 0 && (
              <Badge variant="warning">{unpaidInvoices.length} pending</Badge>
            )}
          </div>

          {loadingUnpaid ? (
            <div className="bg-surface rounded-[16px] border border-border shadow-card p-8">
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-[12px]" />)}
              </div>
            </div>
          ) : unpaidInvoices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-12 h-12 rounded-[14px] bg-success-50 text-success-600 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={24} />
                </div>
                <p className="font-semibold text-heading">All caught up!</p>
                <p className="text-sm text-muted mt-1">There are no unpaid invoices at this time.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Invoice</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">Date</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Due</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3.5 text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {unpaidInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-[10px] bg-orange-50 text-orange-600 flex items-center justify-center">
                              <FileText size={16} />
                            </div>
                            <div>
                              <p className="font-semibold text-heading">{inv.number}</p>
                              <p className="text-xs text-muted">{inv.customerName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted hidden lg:table-cell">
                          {formatDate(inv.issueDate)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("text-sm", inv.status === "overdue" ? "text-danger-600 font-semibold" : "text-muted")}>
                            {formatDate(inv.dueDate)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold tabular-nums text-heading">
                          {formatCurrency(inv.total)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={inv.status === "overdue" ? "danger" : "info"}>
                            {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="success" size="sm">
                            <DollarSign size={14} />
                            Record Payment
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>

        {/* Payment History */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-heading">Recent Payments</h2>
          <DataTable
            columns={paymentColumns}
            data={paymentsData?.items ?? []}
            keyExtractor={(p) => p.id}
            loading={loadingPayments}
            page={paymentPage}
            total={paymentsData?.total}
            pageSize={10}
            onPageChange={setPaymentPage}
          />
        </section>
      </motion.div>
    </>
  )
}
