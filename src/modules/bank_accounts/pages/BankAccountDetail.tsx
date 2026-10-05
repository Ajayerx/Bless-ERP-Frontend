"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom"
import { ArrowLeft, Edit, Trash2, Landmark, ExternalLink, Landmark as LandmarkIcon } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Link, Badge, Modal } from "@/components/ui"
import { bankAccountService } from "@/services"
import type { BankAccount } from "@/services"
import { listBankTransactions, type BankTransactionDoc } from "@/modules/bank_transactions/services"
import { bankAccountEnabled } from "../components/BankAccountTable"

function usd(n: number | string | null | undefined): string {
  if (n == null || n === "") return "$0.00"
  const v = typeof n === "string" ? parseFloat(n) : n
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default function BankAccountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<BankAccount | null>(null)
  const [transactions, setTransactions] = useState<BankTransactionDoc[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    if (!id) return
    bankAccountService.getById(id).then(setAccount).catch(() => null).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    setTxLoading(true)
    listBankTransactions({ bankAccount: id, pageSize: 5 })
      .then(setTransactions)
      .catch(() => setTransactions([]))
      .finally(() => setTxLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await bankAccountService.delete(id)
      navigate("/bank-accounts")
    } finally { setDeleting(false); setShowDeleteModal(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!account) return <><Topbar /><div className="p-6 text-center text-muted">Account not found</div></>

  const isCompany = (account.is_company_account ?? 0) === 1
  const isDefault = (account.is_default ?? 0) === 1
  const enabled = bankAccountEnabled(account)

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Bank", value: account.bank || "—" },
    {
      label: isCompany ? "Company" : "Party",
      value: isCompany
        ? (account.company || "—")
        : `${account.party_type ?? "Party"}${account.party ? ` · ${account.party}` : ""}`,
    },
    { label: "Company Account", value: account.account || "—" },
    { label: "Bank Account Type", value: account.account_type || "—" },
    { label: "Bank Account Subtype", value: account.account_subtype || "—" },
    { label: "Bank Account No.", value: account.bank_account_no || "—" },
    { label: "IBAN", value: account.iban || "—" },
    { label: "Branch Code", value: account.branch_code || "—" },
    { label: "Last Integration Date", value: account.last_integration_date || "—" },
  ]

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <Link to="/bank-accounts" className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={18} /> Back to Bank Accounts
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/bank-accounts/${encodeURIComponent(account.name)}/edit`)}>
              <Edit size={14} /> Edit
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="text-danger-600 border-danger-200 hover:bg-danger-50">
              <Trash2 size={14} /> Delete
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-3 rounded-[12px] bg-primary-50 text-primary-600 shrink-0">
                <Landmark size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-heading truncate">{account.account_name}</h1>
                <p className="text-sm text-muted truncate">{account.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant={isCompany ? "info" : "purple"}>{isCompany ? "Company Account" : account.party_type || "Party Account"}</Badge>
              {isDefault && <Badge variant="success">Default</Badge>}
              <Badge variant={enabled ? "success" : "default"}>{enabled ? "Enabled" : "Disabled"}</Badge>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="min-w-0">
                <span className="text-xs text-muted">{r.label}</span>
                <p className="text-body font-medium truncate mt-0.5">{r.value}</p>
              </div>
            ))}
          </div>

          <div className="h-px bg-border" />

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/bank-reconciliation${account.name ? `?bank_account=${encodeURIComponent(account.name)}` : ""}`)}
            >
              Open Reconciliation <ExternalLink size={13} className="ml-1" />
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-heading flex items-center gap-2">
              <LandmarkIcon size={16} className="text-muted" /> Linked Bank Transactions
            </h2>
            <Link
              to={`/bank-transactions?bankAccount=${encodeURIComponent(account.name)}&status=Unreconciled`}
              className="text-sm text-primary-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {txLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted">No bank transactions linked to this account yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((t) => (
                <RouterLink
                  key={t.name}
                  to={`/bank-transactions/${t.name}`}
                  className="flex items-center justify-between gap-3 py-3 group"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-body truncate group-hover:text-primary-700">
                      {t.description || t.name}
                    </p>
                    <p className="text-xs text-muted">{t.date} · {t.status}</p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ${(t.deposit || 0) > 0 ? "text-success-600" : "text-body"}`}>
                    {(t.deposit || 0) > 0 ? `+${usd(t.deposit)}` : usd(t.withdrawal)}
                  </span>
                </RouterLink>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Bank Account">
        <p>
          Are you sure you want to delete <strong>{account.name}</strong>?
          {transactions.length > 0 && <span className="block mt-2 text-xs text-muted">This account has linked bank transactions.</span>}
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleDelete} loading={deleting} className="bg-danger-600 hover:bg-danger-700">Delete</Button>
        </div>
      </Modal>
    </>
  )
}