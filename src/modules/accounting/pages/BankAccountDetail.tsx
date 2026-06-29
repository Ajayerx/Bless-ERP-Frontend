"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Building2, CreditCard, Landmark, Banknote } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { accountingService } from "@/services"
import type { BankAccount } from "@/modules/accounting/types"
import { formatCurrency } from "@/lib/utils"

export default function BankAccountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<BankAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    accountingService.getBankAccount(id).then(setAccount).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-[16px]" />)}
          </div>
          <Skeleton className="h-48 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!account) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Bank account not found.</p>
          <Button className="mt-4" onClick={() => navigate("/accounting/bank-accounts")}>Back to Bank Accounts</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/accounting/bank-accounts")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{account.accountName}</h1>
                <Badge variant={account.status === "active" ? "success" : "default"}>
                  {account.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">{account.bankName} • {account.accountNumber}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-success-600 bg-success-50"><Banknote size={20} /></div>
              <div>
                <p className="text-sm text-muted">Current Balance</p>
                <p className={`text-xl font-bold tabular-nums ${account.balance < 0 ? "text-danger-600" : "text-heading"}`}>
                  {formatCurrency(account.balance)} {account.currency}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-primary-600 bg-primary-50"><Landmark size={20} /></div>
              <div>
                <p className="text-sm text-muted">Bank</p>
                <p className="text-lg font-semibold text-heading">{account.bankName}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-info-600 bg-info-50"><CreditCard size={20} /></div>
              <div>
                <p className="text-sm text-muted">Account Type</p>
                <p className="text-lg font-semibold text-heading capitalize">{account.type}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Account Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Row icon={Banknote} label="Account Name" value={account.accountName} />
            <Row icon={CreditCard} label="Account Number" value={account.accountNumber} />
            <Row icon={Building2} label="Bank Name" value={account.bankName} />
            <Row icon={Landmark} label="Branch" value={account.branch} />
            <Row icon={Banknote} label="Type" value={account.type.charAt(0).toUpperCase() + account.type.slice(1)} />
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={16} className="text-muted shrink-0" />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-semibold text-heading">{value}</p>
      </div>
    </div>
  )
}
