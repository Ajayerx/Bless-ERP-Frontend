import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Search } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Card, CardContent, Input, LinkSearchField, Select } from "@/components/ui"
import { searchLink } from "@/services"
import { listBankTransactions } from "../services"
import type { BankTransactionDoc } from "../types"
import BankTransactionTable from "../components/BankTransactionTable"

const STATUS_OPTIONS = ["", "Pending", "Settled", "Unreconciled", "Reconciled", "Cancelled"]
const PAGE_SIZE = 20

export default function BankTransactions() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<BankTransactionDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")
  const [bankAccount, setBankAccount] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listBankTransactions({ status, bankAccount, search, page, pageSize: PAGE_SIZE }))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [status, bankAccount, search, page])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading">Bank Transactions</h1>
          <p className="text-sm text-muted mt-1">
            Every deposit, withdrawal and reconciliation created by the Bank Reconciliation tool.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                id="bt-search"
                label="Search"
                placeholder="Search description or reference"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
              <Select
                id="bt-status"
                label="Status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option || "all"} value={option}>
                    {option || "All"}
                  </option>
                ))}
              </Select>
              <LinkSearchField
                label="Bank Account"
                placeholder="Select Bank Account"
                value={bankAccount}
                searchFn={(query) =>
                  searchLink("Bank Account", query, undefined, [["is_company_account", "=", 1]]).then(
                    (items) => ({
                      items: items.map((i) => ({ ...i, description: i.description ?? "" })),
                    })
                  )
                }
                onChange={(value) => {
                  setBankAccount(value ?? "")
                  setPage(1)
                }}
              />
            </div>
          </CardContent>
        </Card>

        <BankTransactionTable
          rows={rows}
          loading={loading}
          onRowClick={(doc) => navigate(`/bank-transactions/${encodeURIComponent(doc.name)}`)}
        />

        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            Previous
          </Button>
          <span className="text-sm text-muted">Page {page}</span>
          <Button
            variant="ghost"
            onClick={() => setPage((p) => p + 1)}
            disabled={rows.length < PAGE_SIZE || loading}
          >
            Next
          </Button>
          <Button variant="secondary" onClick={() => void fetchData()} loading={loading}>
            <Search size={16} /> Refresh
          </Button>
        </div>
      </motion.div>
    </>
  )
}
