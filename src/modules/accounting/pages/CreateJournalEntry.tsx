"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { accountingService } from "@/services"
import { formatCurrency } from "@/lib/utils"

interface JournalLineForm {
  id: string
  accountName: string
  debit: number
  credit: number
}

function createEmptyLine(): JournalLineForm {
  return { id: crypto.randomUUID(), accountName: "", debit: 0, credit: 0 }
}

export default function CreateJournalEntry() {
  const navigate = useNavigate()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState("")
  const [reference, setReference] = useState("")
  const [lines, setLines] = useState<JournalLineForm[]>([createEmptyLine(), createEmptyLine()])
  const [saving, setSaving] = useState(false)

  const addLine = () => setLines((prev) => [...prev, createEmptyLine()])
  const removeLine = (id: string) => setLines((prev) => (prev.length > 2 ? prev.filter((l) => l.id !== id) : prev))

  const updateLine = (id: string, updates: Partial<JournalLineForm>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))

  const totalDebit = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100
  const totalCredit = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  const handleSave = async () => {
    if (!description || !balanced) return
    setSaving(true)
    try {
      await accountingService.createJournalEntry({
        date, description, reference,
        lines: lines.map(({ id: _id, ...rest }) => rest),
        totalDebit, totalCredit,
      })
      navigate("/accounting/journal-entries")
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6 max-w-4xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/accounting/journal-entries")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">New Journal Entry</h1>
              <p className="text-sm text-muted mt-0.5">Create a general ledger journal entry.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/accounting/journal-entries")}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !description || !balanced} loading={saving}>
              <Save size={16} /> {saving ? "Saving..." : "Save Entry"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Entry Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Reference</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional ref #" className={inputClass} />
              </div>
              <div className="flex items-end">
                <div className={`w-full px-3 py-2.5 rounded-[12px] text-sm font-bold text-center ${balanced ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"}`}>
                  {balanced ? "Balanced" : "Unbalanced"}
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the entry" className={inputClass} />
            </div>
          </CardContent>
        </Card>

        <Card className="p-0 overflow-hidden">
          <CardHeader><CardTitle>Journal Lines</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase w-[50%]">Account</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-danger-600 uppercase w-[18%]">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-success-600 uppercase w-[18%]">Credit</th>
                  <th className="px-4 py-3 w-[10%]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {lines.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-2.5">
                      <input value={line.accountName} onChange={(e) => updateLine(line.id, { accountName: e.target.value })}
                        placeholder="Account name" className="w-full px-3 py-2 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                    </td>
                    <td className="px-4 py-2.5">
                      <input type="number" min={0} step={0.01} value={line.debit || ""} onChange={(e) => updateLine(line.id, { debit: Math.max(0, parseFloat(e.target.value) || 0), credit: 0 })}
                        placeholder="0.00" className="w-full px-2 py-1.5 text-sm text-right border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                    </td>
                    <td className="px-4 py-2.5">
                      <input type="number" min={0} step={0.01} value={line.credit || ""} onChange={(e) => updateLine(line.id, { credit: Math.max(0, parseFloat(e.target.value) || 0), debit: 0 })}
                        placeholder="0.00" className="w-full px-2 py-1.5 text-sm text-right border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button type="button" onClick={() => removeLine(line.id)} disabled={lines.length <= 2}
                        className="p-1.5 rounded-[8px] text-muted hover:text-danger-600 hover:bg-danger-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50/80">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-heading">Totals</td>
                  <td className="px-4 py-4 text-right text-sm font-bold tabular-nums text-danger-600">{formatCurrency(totalDebit)}</td>
                  <td className="px-4 py-4 text-right text-sm font-bold tabular-nums text-success-600">{formatCurrency(totalCredit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-border">
            <button onClick={addLine} className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
              <Plus size={14} /> Add Line
            </button>
          </div>
        </Card>
      </motion.div>
    </>
  )
}
