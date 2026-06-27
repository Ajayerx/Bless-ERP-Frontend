"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Calendar, Hash, FileText, CheckCircle2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { accountingService } from "@/services"
import type { JournalEntry } from "@/modules/accounting/types"
import { formatCurrency, formatDate } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: "success" | "default" }> = {
  draft: { label: "Draft", variant: "default" },
  posted: { label: "Posted", variant: "success" },
}

export default function JournalEntryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    accountingService.getJournalEntry(id).then(setEntry).finally(() => setLoading(false))
  }, [id])

  const handlePost = async () => {
    if (!id) return
    const updated = await accountingService.updateJournalEntry(id, { status: "posted" })
    setEntry(updated)
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 rounded-[16px]" />
          <Skeleton className="h-48 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!entry) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Journal entry not found.</p>
          <Button className="mt-4" onClick={() => navigate("/accounting/journal-entries")}>Back to Journal Entries</Button>
        </div>
      </>
    )
  }

  const balanced = Math.abs(entry.totalDebit - entry.totalCredit) < 0.01

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/accounting/journal-entries")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{entry.number}</h1>
                <Badge variant={statusConfig[entry.status]?.variant ?? "default"}>
                  {statusConfig[entry.status]?.label ?? entry.status}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">{entry.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {entry.status === "draft" && (
              <Button onClick={handlePost}><CheckCircle2 size={14} /> Post Entry</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-primary-600 bg-primary-50"><Calendar size={20} /></div>
              <div>
                <p className="text-sm text-muted">Date</p>
                <p className="text-lg font-semibold text-heading">{formatDate(entry.date)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-info-600 bg-info-50"><Hash size={20} /></div>
              <div>
                <p className="text-sm text-muted">Reference</p>
                <p className="text-lg font-semibold text-heading">{entry.reference || "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={balanced ? "bg-gradient-to-br from-success-50 to-surface border-success-100" : "bg-gradient-to-br from-danger-50 to-surface border-danger-100"}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`p-3 rounded-[10px] ${balanced ? "bg-success-100 text-success-700" : "bg-danger-100 text-danger-700"}`}><FileText size={20} /></div>
              <div>
                <p className="text-sm text-muted">Status</p>
                <p className={`text-lg font-bold ${balanced ? "text-success-700" : "text-danger-700"}`}>
                  {balanced ? "Balanced" : "Unbalanced"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          <CardHeader><CardTitle>Journal Lines</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase">Account</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-danger-600 uppercase">Debit</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-success-600 uppercase">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {entry.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-heading">{line.accountName}</td>
                    <td className="px-6 py-4 text-right text-sm font-semibold tabular-nums text-danger-600">
                      {line.debit > 0 ? formatCurrency(line.debit) : "—"}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold tabular-nums text-success-600">
                      {line.credit > 0 ? formatCurrency(line.credit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50/80">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-heading">Totals</td>
                  <td className="px-6 py-4 text-right text-sm font-bold tabular-nums text-danger-600">{formatCurrency(entry.totalDebit)}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold tabular-nums text-success-600">{formatCurrency(entry.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </motion.div>
    </>
  )
}
