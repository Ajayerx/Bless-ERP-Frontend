"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Link } from "@/components/ui"
import { bankAccountService, type BankAccount, type BankAccountFormData } from "@/services/bank_accounts.service"
import BankAccountForm from "@/modules/bank_accounts/BankAccountForm"

export default function EditBankAccount() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
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
      navigate(`/bank-accounts/${id}`)
    } finally { setSaving(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!account) return <><Topbar /><div className="p-6 text-center text-muted">Account not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/bank-accounts/${id}`}><ArrowLeft size={18} /><span>Back</span></Link>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">Edit Bank Account</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <BankAccountForm defaultValues={account} onSubmit={onSubmit} loading={saving} />
        </div>
      </motion.div>
    </>
  )
}
