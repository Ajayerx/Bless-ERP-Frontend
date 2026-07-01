"use client"
import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { bankAccountService, type BankAccountListResponse } from "@/services/bank_accounts.service"
import BankAccountTable from "@/modules/bank_accounts/BankAccountTable"

export default function BankAccounts() {
  const navigate = useNavigate()
  const [data, setData] = useState<BankAccountListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await bankAccountService.list()
      setData(result)
    } finally { setLoading(false) }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Bank Accounts</h1>
            <p className="text-sm text-muted mt-1">Manage your business bank accounts.</p>
          </div>
          <Button onClick={() => navigate("/bank-accounts/new")}><Plus size={16} /> New Account</Button>
        </div>
        <BankAccountTable
          data={data} loading={loading} search={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          page={page} onPageChange={setPage}
          onRowClick={(a) => navigate(`/bank-accounts/${a.id}`)}
        />
      </motion.div>
    </>
  )
}
