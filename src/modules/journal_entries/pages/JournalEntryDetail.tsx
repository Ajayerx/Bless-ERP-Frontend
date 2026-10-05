"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft,
  Copy,
  Edit,
  Mail,
  Printer,
  RotateCcw,
  Send,
  Trash2,
  MoreVertical,
} from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import {
  Skeleton,
  Button,
  Badge,
  ConfirmationDialog,
  useMessageDialog,
  messageFromError,
} from "@/components/ui"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { journalEntryService, type JournalEntryDoc } from "@/services"
import type { JournalEntryAccountRow } from "@/services/journal-entry.service"
import { formatCurrency, formatDate } from "@/lib/utils"

type Docstatus = 0 | 1 | 2

const DOCSTATUS_META: Record<Docstatus, { label: string; variant: "warning" | "success" | "danger" }> = {
  0: { label: "Draft", variant: "warning" },
  1: { label: "Submitted", variant: "success" },
  2: { label: "Cancelled", variant: "danger" },
}

export default function JournalEntryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showMessage } = useMessageDialog()
  const [doc, setDoc] = useState<JournalEntryDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [confirmAction, setConfirmAction] = useState<null | "submit" | "cancel" | "amend" | "delete">(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    journalEntryService.getById(id).then(setDoc).catch(() => null).finally(() => setLoading(false))
  }, [id])

  const handleConfirm = async () => {
    if (!id || !confirmAction) return
    setActing(true)
    setActionError(null)
    try {
      if (confirmAction === "submit") {
        await journalEntryService.submitDoc(id)
        showMessage(`Submitted ${id}.`)
        setConfirmAction(null)
      } else if (confirmAction === "cancel") {
        await journalEntryService.cancelDoc(id)
        showMessage(`Cancelled ${id}.`)
        setConfirmAction(null)
      } else if (confirmAction === "amend" && doc) {
        const amended = await journalEntryService.amend(doc)
        setConfirmAction(null)
        showMessage(`Created amended copy ${amended.name}.`)
        navigate(`/journal-entries/${encodeURIComponent(amended.name)}`)
        return
      } else if (confirmAction === "delete") {
        await journalEntryService.delete(id)
        setConfirmAction(null)
        showMessage(`Deleted ${id}.`)
        navigate("/journal-entries")
        return
      }
      const fresh = await journalEntryService.getById(id)
      setDoc(fresh)
    } catch (err) {
      const errMsg = messageFromError(err, "Action failed.")
      setActionError(typeof errMsg === "string" ? errMsg : errMsg.message)
    } finally {
      setActing(false)
    }
  }

  if (loading) return <><Topbar /><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!doc) return <><Topbar /><div className="p-6 text-center text-muted">Entry not found</div></>

  const docstatus = Number(doc.docstatus) as Docstatus
  const meta = DOCSTATUS_META[docstatus] ?? DOCSTATUS_META[0]
  const isDraft = docstatus === 0
  const isSubmitted = docstatus === 1
  const accounts = (Array.isArray(doc.accounts) ? doc.accounts : []) as JournalEntryAccountRow[]
  const rawDoc = doc as unknown as Record<string, unknown>
  const amendedFrom = String(rawDoc.amended_from ?? "")
  const totalDebit = Number(doc.total_debit) || accounts.reduce((s, a) => s + (Number(a.debit_in_account_currency) || 0), 0)
  const totalCredit = Number(doc.total_credit) || accounts.reduce((s, a) => s + (Number(a.credit_in_account_currency) || 0), 0)
  const difference = Number(doc.difference ?? 0)
  const glUrl = `/reports/general-ledger?voucher_type=${encodeURIComponent(doc.voucher_type || "Journal Entry")}&voucher_no=${encodeURIComponent(doc.name)}`

  const confirmInfo: Record<string, { title: string; message: string }> = {
    submit: { title: "Submit Entry", message: `Permanently submit ${doc.name}? This action cannot be undone.` },
    cancel: { title: "Cancel Entry", message: `Permanently cancel ${doc.name}? This action cannot be undone.` },
    amend: { title: "Amend Entry", message: `Create an amended draft copy of ${doc.name}? The original is preserved.` },
    delete: { title: "Delete Entry", message: `Delete ${doc.name}? This action cannot be undone.` },
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-6xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/journal-entries" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={16} /> Back to Journal Entries
          </Link>
          <div className="flex items-center gap-2">
            {isDraft && (
              <>
                <Button variant="outline" onClick={() => navigate(`/journal-entries/${encodeURIComponent(doc.name)}/edit`)}>
                  <Edit size={14} /> Edit
                </Button>
                <Button onClick={() => setConfirmAction("submit")}>
                  <Send size={14} /> Submit
                </Button>
              </>
            )}
            {isSubmitted && (
              <Button variant="outline" className="text-danger-600 border-danger-200 hover:bg-danger-50" onClick={() => setConfirmAction("cancel")}>
                <RotateCcw size={14} /> Cancel
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isSubmitted && (
                  <DropdownMenuItem onClick={() => setConfirmAction("amend")}>
                    <Copy size={14} /> Amend
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => window.print()}>
                  <Printer size={14} /> Print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.assign(`mailto:?subject=${encodeURIComponent(doc.name)}&body=${encodeURIComponent(glUrl)}`)}>
                  <Mail size={14} /> Email
                </DropdownMenuItem>
                {!isSubmitted && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-danger-600 data-[highlighted]:text-danger-700" onClick={() => setConfirmAction("delete")}>
                      <Trash2 size={14} /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Head */}
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-heading">{doc.name}</h1>
              <p className="text-sm text-muted mt-0.5">{doc.title || "Journal Entry"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">{doc.voucher_type || "Journal Entry"}</Badge>
              <Badge variant={meta.variant}>{meta.label}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted">Posting Date</span><p className="text-body font-medium">{doc.posting_date ? formatDate(doc.posting_date) : "—"}</p></div>
            <div><span className="text-muted">Company</span><p className="text-body font-medium">{doc.company || "—"}</p></div>
            <div><span className="text-muted">Reference</span><p className="text-body font-medium">{doc.bill_no || "—"}</p></div>
            <div>
              <span className="text-muted">General Ledger</span>
              <p className="text-body font-medium">
                <a href={glUrl} className="text-primary-600 hover:underline">View in GL →</a>
              </p>
            </div>
          </div>
        </div>

        {/* Accounts */}
        <div className="mt-6 bg-white rounded-2xl shadow-card p-6 space-y-4">
          <h2 className="text-base font-bold text-heading">Accounts</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                  <th className="py-2 pr-3 font-semibold">Account</th>
                  <th className="py-2 pr-3 font-semibold">Party</th>
                  <th className="py-2 pr-3 font-semibold">Currency</th>
                  <th className="py-2 pr-3 font-semibold text-right">Rate</th>
                  <th className="py-2 pr-3 font-semibold text-right">Debit</th>
                  <th className="py-2 pr-3 font-semibold text-right">Credit</th>
                  <th className="py-2 pr-3 font-semibold">Cost Center</th>
                  <th className="py-2 font-semibold">Project</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr><td colSpan={8} className="py-6 text-center text-muted">No account lines.</td></tr>
                ) : accounts.map((a, i) => (
                  <tr key={String(a.name ?? i)} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-body">{a.account || "—"}</td>
                    <td className="py-2.5 pr-3 text-muted">
                      {a.party ? `${a.party_type || ""}${a.party_type ? " · " : ""}${a.party}` : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-muted">{a.account_currency || "CAD"}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted">{Number(a.exchange_rate) || 1}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-heading">
                      {Number(a.debit_in_account_currency) > 0 ? formatCurrency(Number(a.debit_in_account_currency)) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-heading">
                      {Number(a.credit_in_account_currency) > 0 ? formatCurrency(Number(a.credit_in_account_currency)) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-muted">{a.cost_center || "—"}</td>
                    <td className="py-2.5 text-muted">{a.project || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Totals */}
          <div className="bg-white rounded-2xl shadow-card p-6 space-y-2">
            <h2 className="text-base font-bold text-heading mb-3">Totals</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total Debit</span>
              <span className="font-semibold text-heading tabular-nums">{formatCurrency(totalDebit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total Credit</span>
              <span className="font-semibold text-heading tabular-nums">{formatCurrency(totalCredit)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-border">
              <span className="font-bold text-heading">Difference</span>
              <span className={`font-bold tabular-nums ${Math.abs(difference) > 0.001 ? "text-danger-600" : "text-success-600"}`}>
                {formatCurrency(difference)}
              </span>
            </div>
          </div>

          {/* Activity */}
          <div className="bg-white rounded-2xl shadow-card p-6 space-y-3">
            <h2 className="text-base font-bold text-heading">Activity</h2>
            {doc.user_remark || doc.remark ? (
              <p className="text-sm text-body">{doc.user_remark || doc.remark}</p>
            ) : (
              <p className="text-sm text-muted">No remarks.</p>
            )}
            <div className="text-xs text-muted space-y-1">
              <p>Created by {doc.owner || "—"} on {doc.creation ? formatDate(doc.creation) : "—"}</p>
              <p>Last modified by {doc.modified_by || "—"} on {doc.modified ? formatDate(doc.modified) : "—"}</p>
              {amendedFrom && <p>Amended from {amendedFrom}</p>}
            </div>
          </div>
        </div>
      </motion.div>

      <ConfirmationDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null)
            setActionError(null)
          }
        }}
        onConfirm={handleConfirm}
        title={confirmAction ? confirmInfo[confirmAction].title : ""}
        description={confirmAction ? confirmInfo[confirmAction].message : ""}
        confirmLabel={confirmAction === "submit" ? "Submit" : confirmAction === "cancel" ? "Cancel Entry" : confirmAction === "amend" ? "Amend" : "Delete"}
        cancelLabel="No, go back"
        variant={confirmAction === "delete" || confirmAction === "cancel" ? "danger" : "warning"}
        loading={acting}
        error={actionError}
      />
    </>
  )
}