"use client"

import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Pencil, Send, RotateCcw, Trash2, FileEdit, Package, Receipt, Printer, Mail, MoreHorizontal, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, ConfirmationDialog, useMessageDialog, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui"
import { purchaseOrderService, type PurchaseOrderDoc } from "@/services"
import PurchaseDetailCard from "../components/PurchaseDetailCard"

type Action = "submit" | "cancel" | "delete" | "amend"

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showMessage } = useMessageDialog()
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<Action | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = () => {
    if (!id) return
    setLoading(true)
    purchaseOrderService
      .getDoc(id)
      .then(setPurchaseOrder)
      .catch(() => setPurchaseOrder(null))
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
        await purchaseOrderService.submitDoc(id)
        showMessage(`Submitted ${id}.`)
      } else if (confirmAction === "cancel") {
        await purchaseOrderService.cancelDoc(id)
        showMessage(`Cancelled ${id}.`)
      } else if (confirmAction === "amend") {
        const doc = await purchaseOrderService.getDoc(id)
        const amended = await purchaseOrderService.amend(doc)
        showMessage(`Amended ${id} into new draft ${amended.name}.`)
        navigate(`/purchases/${encodeURIComponent(amended.name)}/edit`)
        return
      } else {
        await purchaseOrderService.delete(id)
        showMessage(`Deleted ${id}.`)
        navigate("/purchases")
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

  const handleMake = async (kind: "receipt" | "invoice") => {
    if (!id) return
    setActing(true)
    setActionError(null)
    try {
      const created = kind === "receipt"
        ? await purchaseOrderService.makePurchaseReceipt(id)
        : await purchaseOrderService.makePurchaseInvoice(id)
      showMessage(`${created.doctype || (kind === "receipt" ? "Purchase Receipt" : "Purchase Invoice")} draft created from ${id}.`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.")
    } finally {
      setActing(false)
    }
  }

  const actions = purchaseOrder
    ? ([
        purchaseOrder.docstatus === 1
          ? { key: "cancel", label: "Cancel", icon: <RotateCcw size={14} />, action: "cancel" as Action }
          : null,
        purchaseOrder.docstatus === 1
          ? null
          : { key: "submit", label: "Submit", icon: <Send size={14} />, action: "submit" as Action },
        purchaseOrder.docstatus === 1
          ? { key: "amend", label: "Amend", icon: <FileEdit size={14} />, action: "amend" as Action }
          : null,
        { key: "delete", label: "Delete", icon: <Trash2 size={14} />, action: "delete" as Action, danger: true },
      ].filter(Boolean) as Array<{ key: string; label: string; icon: React.ReactNode; action: Action; danger?: boolean }>)
    : []

  const confirmCopy = (() => {
    if (!confirmAction) return { title: "", message: "" }
    if (!purchaseOrder) return { title: "", message: "" }
    switch (confirmAction) {
      case "submit":
        return { title: "Submit Purchase Order", message: `Permanently submit ${purchaseOrder.name}? This action cannot be undone.` }
      case "cancel":
        return { title: "Cancel Purchase Order", message: `Permanently cancel ${purchaseOrder.name}? This action cannot be undone.` }
      case "amend":
        return { title: "Amend Purchase Order", message: `Create a new draft copy of ${purchaseOrder.name}?` }
      default:
        return { title: "Delete Purchase Order", message: `Delete ${purchaseOrder.name}? This action cannot be undone.` }
    }
  })()

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-6xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/purchases" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={16} /> Back to Purchases
          </Link>
          {purchaseOrder && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/purchases/${id}/edit`)}
                disabled={purchaseOrder.docstatus !== 0}
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
              {purchaseOrder.docstatus === 1 && purchaseOrder.per_received < 100 && (
                <Button variant="secondary" size="sm" onClick={() => void handleMake("receipt")} disabled={acting}>
                  <Package size={14} /> Make Purchase Receipt
                </Button>
              )}
              {purchaseOrder.docstatus === 1 && purchaseOrder.per_billed < 100 && (
                <Button variant="secondary" size="sm" onClick={() => void handleMake("invoice")} disabled={acting}>
                  <Receipt size={14} /> Make Purchase Invoice
                </Button>
              )}
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
        ) : !purchaseOrder ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>Purchase order not found.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <PurchaseDetailCard purchaseOrder={purchaseOrder} />
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
          confirmLabel={confirmAction === "submit" ? "Submit" : confirmAction === "cancel" ? "Cancel Purchase Order" : confirmAction === "amend" ? "Amend" : "Delete"}
          cancelLabel="No, go back"
          variant={confirmAction === "submit" ? "warning" : "danger"}
          loading={acting}
          error={actionError}
        />
      </motion.div>
    </>
  )
}