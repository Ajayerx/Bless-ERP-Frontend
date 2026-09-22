import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { RefreshCw, Upload } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  LinkSearchField,
  messageFromError,
  useMessageDialog,
} from "@/components/ui"
import { apiClient } from "@/services/api-client"
import { searchLink } from "@/services"
import {
  autoReconcileVouchers,
  getAccountBalance,
  getBankTransactions,
} from "../services"
import type { BankReconciliationFilters, BankTransaction } from "../types"
import NumberCards from "../components/NumberCards"
import BankTransactionsTable from "../components/BankTransactionsTable"
import ReconcileBankTransactionDialog from "../components/ReconcileBankTransactionDialog"

const CURRENCY = "CAD"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function monthAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

function dayBefore(date: string): string {
  if (!date) return ""
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ""
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export default function BankReconciliationTool() {
  const navigate = useNavigate()
  const { showMessage } = useMessageDialog()

  const [filters, setFilters] = useState<BankReconciliationFilters>({
    company: "Bless Erp",
    bank_account: "",
    from_date: monthAgo(),
    to_date: today(),
    from_reference_date: "",
    to_reference_date: "",
    filter_by_reference_date: false,
    bank_statement_opening_balance: 0,
    bank_statement_closing_balance: 0,
  })
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [erpBalance, setErpBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<"" | "auto">("")
  const [selected, setSelected] = useState<BankTransaction | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient<{ default_company?: string }>("/resource/Global Defaults/Global Defaults")
      .then((defaults) => {
        if (!cancelled && defaults?.default_company) {
          setFilters((f) => ({ ...f, company: defaults.default_company as string }))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const patch = (values: Partial<BankReconciliationFilters>) =>
    setFilters((f) => ({ ...f, ...values }))

  const difference = useMemo(
    () => filters.bank_statement_closing_balance - erpBalance,
    [filters.bank_statement_closing_balance, erpBalance]
  )

  const handleGet = useCallback(async () => {
    if (!filters.bank_account) {
      showMessage("Bank Account is required")
      return
    }
    setLoading(true)
    try {
      const { transactions: rows } = await getBankTransactions({
        bank_account: filters.bank_account,
        from_date: filters.from_date,
        to_date: filters.to_date,
        filter_by_reference_date: filters.filter_by_reference_date,
      })
      setTransactions(rows)
      const [balance, opening] = await Promise.all([
        getAccountBalance(filters.bank_account, filters.to_date, filters.company),
        getAccountBalance(filters.bank_account, dayBefore(filters.from_date), filters.company),
      ])
      setErpBalance(balance)
      setFilters((f) => ({ ...f, bank_statement_opening_balance: opening }))
    } catch (err) {
      showMessage(messageFromError(err, "Failed to fetch bank transactions."))
    } finally {
      setLoading(false)
    }
  }, [filters, showMessage])

  const handleAutoReconcile = useCallback(async () => {
    if (!filters.bank_account) {
      showMessage("Bank Account is required")
      return
    }
    setBusy("auto")
    try {
      const result = await autoReconcileVouchers({
        bank_account: filters.bank_account,
        from_date: filters.from_date,
        to_date: filters.to_date,
        filter_by_reference_date: filters.filter_by_reference_date,
        from_reference_date: filters.from_reference_date,
        to_reference_date: filters.to_reference_date,
      })
      showMessage(`Auto Reconciliation completed. ${result.matched} transaction(s) reconciled.`)
      await handleGet()
    } catch (err) {
      showMessage(messageFromError(err, "Auto reconciliation failed."))
    } finally {
      setBusy("")
    }
  }, [filters, showMessage, handleGet])

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
          <h1 className="text-2xl font-bold tracking-tight text-heading">Bank Reconciliation</h1>
          <p className="text-sm text-muted mt-1">
            Match bank transactions against vouchers and reconcile your bank account.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Input id="br-company" label="Company" value={filters.company} readOnly disabled />
              <LinkSearchField
                label="Bank Account"
                placeholder="Select Bank Account"
                value={filters.bank_account}
                searchFn={(query) =>
                  searchLink("Bank Account", query, undefined, [["is_company_account", "=", 1]]).then(
                    (items) => ({
                      items: items.map((i) => ({ ...i, description: i.description ?? "" })),
                    })
                  )
                }
                onChange={(value) => patch({ bank_account: value ?? "" })}
              />
              {/* bank_statement_from_date / to_date:
                  eval: doc.bank_account && !doc.filter_by_reference_date */}
              {filters.bank_account && !filters.filter_by_reference_date && (
                <>
                  <Input
                    id="br-from-date"
                    label="From Date"
                    type="date"
                    value={filters.from_date}
                    onChange={(e) => patch({ from_date: e.target.value })}
                  />
                  <Input
                    id="br-to-date"
                    label="To Date"
                    type="date"
                    value={filters.to_date}
                    onChange={(e) => patch({ to_date: e.target.value })}
                  />
                </>
              )}
              {/* from_reference_date / to_reference_date: eval:doc.filter_by_reference_date */}
              {filters.filter_by_reference_date && (
                <>
                  <Input
                    id="br-from-reference-date"
                    label="From Reference Date"
                    type="date"
                    value={filters.from_reference_date}
                    onChange={(e) => patch({ from_reference_date: e.target.value })}
                  />
                  <Input
                    id="br-to-reference-date"
                    label="To Reference Date"
                    type="date"
                    value={filters.to_reference_date}
                    onChange={(e) => patch({ to_reference_date: e.target.value })}
                  />
                </>
              )}
              {/* account_opening_balance: eval: doc.bank_statement_from_date (read_only) */}
              {filters.from_date && (
                <Input
                  id="br-opening-balance"
                  label="Account Opening Balance"
                  value={String(filters.bank_statement_opening_balance || "")}
                  readOnly
                  disabled
                />
              )}
              {/* bank_statement_closing_balance: eval: doc.bank_statement_to_date */}
              {filters.to_date && (
                <Input
                  id="br-statement-balance"
                  label="Closing Balance"
                  type="number"
                  value={String(filters.bank_statement_closing_balance || "")}
                  onChange={(e) => patch({ bank_statement_closing_balance: Number(e.target.value || 0) })}
                />
              )}
              <label className="flex items-center gap-2 text-sm text-body self-end pb-2.5">
                <Checkbox
                  aria-label="Filter by Reference Date"
                  checked={filters.filter_by_reference_date}
                  onCheckedChange={(checked) =>
                    patch(
                      checked === true
                        ? {
                            filter_by_reference_date: true,
                            from_date: "",
                            to_date: "",
                          }
                        : {
                            filter_by_reference_date: false,
                            from_reference_date: "",
                            to_reference_date: "",
                          }
                    )
                  }
                />
                Filter by Reference Date
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => navigate("/bank-reconciliation/import")}>
                <Upload size={16} /> Upload Bank Statement
              </Button>
              <Button variant="ghost" onClick={handleAutoReconcile} loading={busy === "auto"}>
                Auto Reconcile
              </Button>
              <Button onClick={handleGet} loading={loading}>
                <RefreshCw size={16} /> Get Unreconciled Entries
              </Button>
            </div>
          </CardContent>
        </Card>

        <NumberCards
          bankStatementClosingBalance={filters.bank_statement_closing_balance}
          erpClosingBalance={erpBalance}
          difference={difference}
          currency={CURRENCY}
        />

        <BankTransactionsTable
          rows={transactions}
          onAction={setSelected}
          currency={CURRENCY}
          loading={loading}
        />

        <ReconcileBankTransactionDialog
          open={selected !== null}
          transaction={selected}
          currency={CURRENCY}
          onClose={() => setSelected(null)}
          onReconciled={handleGet}
        />
      </motion.div>
    </>
  )
}
