"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Pencil, FileText, Receipt, CreditCard, Wallet } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Card, CardContent, Badge } from "@/components/ui"
import { supplierService, type SupplierDetail, type SupplierDashboardCounts, type SupplierTransaction } from "@/services"
import { formatCurrency } from "@/lib/utils"
import SupplierDetailCard from "../components/SupplierDetailCard"

const TRANSACTION_LABELS: Record<SupplierTransaction["doctype"], string> = {
  "Purchase Order": "PO",
  "Purchase Invoice": "PI",
  "Payment Entry": "Payment",
}

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)
  const [counts, setCounts] = useState<SupplierDashboardCounts | null>(null)
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCounts, setLoadingCounts] = useState(false)
  const [loadingTx, setLoadingTx] = useState(false)

  const load = useCallback((supplierName: string) => {
    setLoading(true)
    setLoadingCounts(true)
    setLoadingTx(true)
    supplierService.getById(supplierName).then(setSupplier).catch(() => null).finally(() => setLoading(false))
    supplierService.getDashboardCounts(supplierName).then(setCounts).catch(() => null).finally(() => setLoadingCounts(false))
    supplierService.getTransactions(supplierName, 8).then(setTransactions).catch(() => []).finally(() => setLoadingTx(false))
  }, [])

  useEffect(() => {
    if (!id) return
    load(id)
  }, [id, load])

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-5xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !supplier ? (
          <p className="text-muted">Supplier not found.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Link to="/suppliers" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body transition-colors">
                <ArrowLeft size={16} /> Back to Suppliers
              </Link>
              <Button variant="outline" size="sm" onClick={() => navigate(`/suppliers/${supplier.name}/edit`)}>
                <Pencil size={14} /> Edit
              </Button>
            </div>

            <SupplierDetailCard supplier={supplier} />

            {/* Dashboard counts */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="flex items-center gap-3">
                  <div className="p-3 rounded-[10px] bg-primary-50 text-primary-600"><FileText size={18} /></div>
                  <div>
                    <p className="text-xs text-muted">Purchase Orders</p>
                    <p className="text-lg font-bold text-heading tabular-nums">{loadingCounts ? "…" : counts?.purchase_orders ?? 0}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3">
                  <div className="p-3 rounded-[10px] bg-warning-50 text-warning-600"><Receipt size={18} /></div>
                  <div>
                    <p className="text-xs text-muted">Purchase Invoices</p>
                    <p className="text-lg font-bold text-heading tabular-nums">{loadingCounts ? "…" : counts?.purchase_invoices ?? 0}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3">
                  <div className="p-3 rounded-[10px] bg-danger-50 text-danger-600"><CreditCard size={18} /></div>
                  <div>
                    <p className="text-xs text-muted">Payment Entries</p>
                    <p className="text-lg font-bold text-heading tabular-nums">{loadingCounts ? "…" : counts?.payment_entries ?? 0}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3">
                  <div className="p-3 rounded-[10px] bg-success-50 text-success-600"><Wallet size={18} /></div>
                  <div>
                    <p className="text-xs text-muted">Outstanding</p>
                    <p className="text-lg font-bold text-heading tabular-nums">{loadingCounts ? "…" : formatCurrency(counts?.outstanding ?? 0)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Addresses & Contacts */}
            {(supplier.addresses.length > 0 || supplier.contacts.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {supplier.addresses.length > 0 && (
                  <Card>
                    <CardContent className="space-y-3">
                      <h3 className="font-bold text-heading">Addresses ({supplier.addresses.length})</h3>
                      {supplier.addresses.map((a) => (
                        <div key={a.name} className="text-sm text-body border border-border rounded-[10px] p-3">
                          <p className="font-semibold text-heading">{a.address_type || "Address"}</p>
                          <p className="mt-1">{a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ""}</p>
                          <p className="text-muted">{[a.city, a.state, a.country].filter(Boolean).join(", ")}{a.pincode ? ` — ${a.pincode}` : ""}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {supplier.contacts.length > 0 && (
                  <Card>
                    <CardContent className="space-y-3">
                      <h3 className="font-bold text-heading">Contacts ({supplier.contacts.length})</h3>
                      {supplier.contacts.map((c) => (
                        <div key={c.name} className="flex items-center justify-between text-sm border border-border rounded-[10px] p-3">
                          <div>
                            <p className="font-semibold text-heading">
                              {[c.first_name, c.last_name].filter(Boolean).join(" ")}
                              {c.is_primary_contact ? " (Primary)" : ""}
                            </p>
                            {(c.email_id || c.mobile_no) && (
                              <p className="text-muted">{[c.email_id, c.mobile_no].filter(Boolean).join(" · ")}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Transactions */}
            <Card>
              <CardContent className="space-y-3">
                <h3 className="font-bold text-heading">Recent Transactions</h3>
                {loadingTx ? (
                  <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-muted">No transactions yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                          <th className="py-2 pr-3 font-semibold">Type</th>
                          <th className="py-2 pr-3 font-semibold">Number</th>
                          <th className="py-2 pr-3 font-semibold">Date</th>
                          <th className="py-2 pr-3 font-semibold text-right">Amount</th>
                          <th className="py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr key={`${t.doctype}-${t.name}`} className="border-b border-border/50 last:border-0">
                            <td className="py-2.5 pr-3">
                              <Badge variant="default">{TRANSACTION_LABELS[t.doctype]}</Badge>
                            </td>
                            <td className="py-2.5 pr-3 text-body font-medium">{t.name}</td>
                            <td className="py-2.5 pr-3 text-muted">{t.date}</td>
                            <td className="py-2.5 pr-3 text-right tabular-nums text-body">{formatCurrency(t.amount)}</td>
                            <td className="py-2.5 text-muted">{t.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>
    </>
  )
}