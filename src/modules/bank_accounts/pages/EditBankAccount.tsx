"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Link } from "@/components/ui"
import { bankAccountService } from "@/services"
import type { BankAccount, BankAccountFormData } from "@/services"
import BankAccountForm, { type BankAccountFormRef } from "../components/BankAccountForm"

function toFormData(account: BankAccount): Partial<BankAccountFormData> {
  return {
    account_name: account.account_name,
    bank: account.bank,
    account: account.account ?? "",
    account_type: account.account_type ?? "",
    account_subtype: account.account_subtype ?? "",
    company: account.company ?? "",
    is_company_account: (account.is_company_account ?? 0) === 1,
    is_default: (account.is_default ?? 0) === 1,
    disabled: (account.disabled ?? 0) === 1,
    party_type: account.party_type ?? "",
    party: account.party ?? "",
    iban: account.iban ?? "",
    bank_account_no: account.bank_account_no ?? "",
    branch_code: account.branch_code ?? "",
    last_integration_date: account.last_integration_date ?? "",
  }
}

export default function EditBankAccount() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const formRef = useRef<BankAccountFormRef>(null)
  const [account, setAccount] = useState<BankAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    bankAccountService.getById(id).then(setAccount).catch(() => null).finally(() => setLoading(false))
  }, [id])

  const onSubmit = async (data: BankAccountFormData) => {
    if (!id) return
    setSaving(true)
    try {
      await bankAccountService.update(id, data)
      navigate(`/bank-accounts/${encodeURIComponent(id)}`)
    } finally { setSaving(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!account) return <><Topbar /><div className="p-6 text-center text-muted">Account not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to={`/bank-accounts/${encodeURIComponent(id ?? "")}`} className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={18} /> Back
          </Link>
          <Button onClick={() => formRef.current?.submit()} loading={saving}><Save size={14} /> Save Changes</Button>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">Edit Bank Account</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <BankAccountForm ref={formRef} initial={toFormData(account)} onSubmit={onSubmit} />
        </div>
      </motion.div>
    </>
  )
}