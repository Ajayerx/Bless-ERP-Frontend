"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Banknote } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button, Badge } from "@/components/ui"
import { accountingService } from "@/services"
import type { BankAccount } from "@/modules/accounting/types"
import { formatCurrency } from "@/lib/utils"

const columns: Column<BankAccount>[] = [
  {
    key: "accountName",
    header: "Account",
    render: (a) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center">
          <Banknote size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{a.accountName}</p>
          <p className="text-xs text-muted">{a.bankName} • {a.accountNumber}</p>
        </div>
      </div>
    ),
  },
  {
    key: "type",
    header: "Type",
    render: (a) => <span className="text-sm capitalize text-body">{a.type}</span>,
  },
  {
    key: "balance",
    header: "Balance",
    className: "text-right",
    render: (a) => (
      <span className={`font-semibold tabular-nums ${a.balance < 0 ? "text-danger-600" : "text-heading"}`}>
        {formatCurrency(a.balance)} {a.currency}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (a) => <Badge variant={a.status === "active" ? "success" : "default"}>{a.status === "active" ? "Active" : "Inactive"}</Badge>,
  },
]

export default function BankAccounts() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: BankAccount[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await accountingService.listBankAccounts({ search, page, pageSize: 10 })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

  const totalBalance = data?.items.reduce((s, a) => s + a.balance, 0) ?? 0

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-success-50 text-success-600"><Banknote size={20} /></div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Bank Accounts</h1>
              <p className="text-sm text-muted mt-1">Manage your business bank accounts.</p>
            </div>
          </div>
          <Button onClick={() => navigate("/accounting/bank-accounts/new")}><Plus size={16} /> Add Account</Button>
        </div>
        {data && (
          <div className="flex items-center gap-6">
            <p className="text-sm text-muted"><strong className="text-heading">{data.total}</strong> accounts</p>
            <p className="text-sm text-muted">Total balance: <strong className="text-heading tabular-nums">{formatCurrency(totalBalance)}</strong></p>
          </div>
        )}
        <DataTable
          columns={columns} data={data?.items ?? []} keyExtractor={(a) => a.id}
          searchable searchPlaceholder="Search accounts..." searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading} page={page} total={data?.total} pageSize={10} onPageChange={setPage}
          onRowClick={(a) => navigate(`/accounting/bank-accounts/${a.id}`)}
        />
      </motion.div>
    </>
  )
}
