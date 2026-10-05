"use client"

import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Pencil, Send, RotateCcw, Trash2, FileEdit, Printer, Mail, MoreHorizontal, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, ConfirmationDialog, useMessageDialog, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui"
import { billService, type PurchaseInvoiceDoc } from "@/services"
import BillDetailCard from "../components/BillDetailCard"

type Action = "submit" | "cancel" | "delete" | "amend"

export default function BillDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showMessage } = useMessageDialog()
  const [bill, setBill] = useState<PurchaseInvoiceDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<Action | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = () => {
    if (!id) return
    setLoading(true)
    billService
      .getDoc(id)
      .then(setBill)
      .catch(() => setBill(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setConfirmAction(null)
    setActionError(null)
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (!confirmAction || !id) return
    setActing(true)
    setActionError(null)
    try {
      if (confirmAction === "submit") {
        await billService.submitDoc(id)
        showMessage(`Submitted ${id}.`)
      } else if (confirmAction === "cancel") {
        await billService.cancelDoc(id)
        showMessage(`Cancelled ${id}.`)
      } else if (confirmAction === "amend") {
        const doc = await billService.getDoc(id)
        const amended = await billService.amend(doc)
        showMessage(`Amended ${id} into new draft ${amended.name}.`)
        navigate(`/bills/${encodeURIComponent(amended.name)}/edit`)
        return
      } else {
        await billService.delete(id)
        showMessage(`Deleted ${id}.`)
        navigate("/bills")
        return
      }
      setConfirmAction(null)
      load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.")
    } finally {
      setActing(false)
    }
  }

  const actions = bill
    ? ([
        bill.docstatus === 1
          ? { key: "cancel", label: "Cancel", icon: <RotateCcw size={14} />, action: "cancel" as Action }
          : null,
        bill.docstatus === 1
          ? null
          : { key: "submit", label: "Submit", icon: <Send size={14} />, action: "submit" as Action },
        bill.docstatus === 1
          ? { key: "amend", label: "Amend", icon: <FileEdit size={14} />, action: "amend" as Action }
          : null,
        { key: "delete", label: "Delete", icon: <Trash2 size={14} />, action: "delete" as Action, danger: true },
      ].filter(Boolean) as Array<{ key: string; label: string; icon: React.ReactNode; action: Action; danger?: boolean }>)
    : []

  const confirmCopy = (() => {
    if (!confirmAction) return { title: "", message: "" }
    if (!bill) return { title: "", message: "" }
    switch (confirmAction) {
      case "submit":
        return { title: "Submit Bill", message: `Permanently submit ${bill.name}? This action cannot be undone.` }
      case "cancel":
        return { title: "Cancel Bill", message: `Permanently cancel ${bill.name}? This action cannot be undone.` }
      case "amend":
        return { title: "Amend Bill", message: `Create a new draft copy of ${bill.name}?` }
      default:
        return { title: "Delete Bill", message: `Delete ${bill.name}? This action cannot be undone.` }
    }
  })()

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-6xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/bills" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={16} /> Back to Bills
          </Link>
          {bill && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/bills/${id}/edit`)}
                disabled={bill.docstatus !== 0}
              >
                <Pencil size={14} /> Edit
              </Button>
              {actions.map((a) => (
                <Button
                  key={a.key}
                  variant={a.danger ? "danger" : "primary"}
                  size="sm"
                  onClick={() => {
                    setActionError(null)
                    setConfirmAction(a.action)
                  }}
                >
                  {a.icon} {a.label}
                </Button>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => showMessage("Print not available yet.")}>
                    <Printer size={14} /> Print
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => showMessage("Email not available yet.")}>
                    <Mail size={14} /> Email
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !bill ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>Bill not found.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <BillDetailCard bill={bill} />
          </div>
        )}

        <ConfirmationDialog
          open={!!confirmAction}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmAction(null)
              setActionError(null)
            }
          }}
          onConfirm={handleConfirm}
          title={confirmCopy.title}
          description={confirmCopy.message}
          confirmLabel={confirmAction === "submit" ? "Submit" : confirmAction === "cancel" ? "Cancel Bill" : confirmAction === "amend" ? "Amend" : "Delete"}
          cancelLabel="No, go back"
          variant={confirmAction === "submit" ? "warning" : "danger"}
          loading={acting}
          error={actionError}
        />
      </motion.div>
    </>
  )
}