"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { accountingService } from "@/services"

const accountTypes = ["checking", "savings", "credit"] as const

export default function CreateBankAccount() {
  const navigate = useNavigate()
  const [accountName, setAccountName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [branch, setBranch] = useState("")
  const [type, setType] = useState<string>("checking")
  const [balance, setBalance] = useState("")
  const [currency, setCurrency] = useState("CAD")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!accountName || !bankName) return
    setSaving(true)
    try {
      await accountingService.createBankAccount({
        accountName,
        accountNumber,
        bankName,
        branch,
        type: type as any,
        balance: parseFloat(balance) || 0,
        currency,
      })
      navigate("/accounting/bank-accounts")
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6 max-w-3xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/accounting/bank-accounts")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">Add Bank Account</h1>
              <p className="text-sm text-muted mt-0.5">Register a new bank account.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/accounting/bank-accounts")}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !accountName || !bankName} loading={saving}>
              <Save size={16} /> {saving ? "Saving..." : "Save Account"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Account Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Account Name</label>
                <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g. Business Checking" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Account Number</label>
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="e.g. ****4521" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Bank Name</label>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Royal Bank of Canada" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Branch</label>
                <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="e.g. Downtown Branch" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Account Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                  {accountTypes.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Opening Balance</label>
                <input type="number" min={0} step={0.01} value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
