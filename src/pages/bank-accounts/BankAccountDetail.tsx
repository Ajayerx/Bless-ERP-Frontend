"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Link, Badge, Modal } from "@/components/ui"
import { bankAccountService, type BankAccount } from "@/services/bank_accounts.service"

const typeMap: Record<string, { label: string; variant: "info" | "success" | "warning" }> = {
  chequing: { label: "Chequing", variant: "info" },
  savings: { label: "Savings", variant: "success" },
  credit: { label: "Credit", variant: "warning" },
}

export default function BankAccountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<BankAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    if (!id) return
    bankAccountService.getById(id).then(setAccount).catch(() => null).finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await bankAccountService.delete(id)
      navigate("/bank-accounts")
    } finally { setDeleting(false); setShowDeleteModal(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!account) return <><Topbar /><div className="p-6 text-center text-muted">Account not found</div></>

  const type = typeMap[account.type] ?? { label: account.type, variant: "info" as const }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/bank-accounts"><ArrowLeft size={18} /><span>Back to Bank Accounts</span></Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/bank-accounts/${id}/edit`)}><Edit size={14} /> Edit</Button>
            <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="text-danger-600 border-danger-200 hover:bg-danger-50"><Trash2 size={14} /> Delete</Button>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-heading">{account.name}</h1>
            <Badge variant={type.variant}>{type.label}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted">Account Number</span><p className="text-body font-medium">{account.accountNumber}</p></div>
            <div><span className="text-muted">Balance</span><p className="text-body font-medium">${account.balance.toLocaleString()} {account.currency}</p></div>
            <div><span className="text-muted">Institution</span><p className="text-body font-medium">{account.institution}</p></div>
            <div><span className="text-muted">Default</span><p className="text-body font-medium">{account.isDefault ? "Yes" : "No"}</p></div>
          </div>
        </div>
      </motion.div>
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Bank Account">
        <p>Are you sure you want to delete <strong>{account.name}</strong>?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleDelete} loading={deleting} className="bg-danger-600 hover:bg-danger-700">Delete</Button>
        </div>
      </Modal>
    </>
  )
}
