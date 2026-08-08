"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"
import { useMessageDialog, messageFromError } from "@/components/ui"
import Modal, { ModalFooter } from "@/components/ui/Modal"
import { paymentService } from "@/services"
import { ApiError } from "@/services/api-client"
import type { UnreconcileAllocation } from "../types"

interface UnReconcileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company: string
  docname: string
  onDone: () => void
}

function formatAmount(v?: number): string {
  return v == null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })
}

export default function UnReconcileDialog({
  open,
  onOpenChange,
  company,
  docname,
  onDone,
}: UnReconcileDialogProps) {
  const { showMessage } = useMessageDialog()
  const [allocations, setAllocations] = useState<UnreconcileAllocation[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const key = (a: UnreconcileAllocation) =>
    `${a.reference_doctype ?? ""}::${a.reference_name ?? ""}`

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await paymentService.unreconcile.getLinkedPaymentsForDoc(
        company,
        "Payment Entry",
        docname
      )
      setAllocations(rows || [])
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load the allocations linked to this Payment Entry."
      setError(message)
      showMessage(messageFromError(err, message))
    } finally {
      setLoading(false)
    }
  }, [company, docname])

  useEffect(() => {
    if (open) {
      setSelected(new Set())
      load()
    }
  }, [open, load])

  const allChecked = allocations.length > 0 && allocations.every((a) => selected.has(key(a)))

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) {
        allocations.forEach((a) => next.delete(key(a)))
      } else {
        allocations.forEach((a) => next.add(key(a)))
      }
      return next
    })
  }

  const toggle = (k: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const close = () => onOpenChange(false)

  const confirm = async () => {
    if (selected.size === 0) {
      setError("Select at least one allocation to unreconcile.")
      return
    }
    setActing(true)
    setError(null)
    try {
      const selections = allocations
        .filter((a) => selected.has(key(a)))
        .map((a) => ({
          company: a.company || company,
          voucher_type: "Payment Entry",
          voucher_no: docname,
          against_voucher_type: a.reference_doctype || "",
          against_voucher_no: a.reference_name || "",
        }))
      await paymentService.unreconcile.createUnreconcileDocForSelection(selections)
      close()
      onDone()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to un-reconcile the selected allocations."
      setError(message)
      showMessage(messageFromError(err, message))
    } finally {
      setActing(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="UnReconcile Allocations"
      description="Un-reconcile this Payment Entry against one or more linked documents."
      size="lg"
    >
      {loading && (
        <div className="flex items-center justify-center py-10 text-muted">
          <Loader2 size={18} className="animate-spin mr-2" /> Loading allocations…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {!loading && allocations.length === 0 && (
        <p className="text-sm text-muted text-center py-6">No allocations found to un-reconcile.</p>
      )}

      {!loading && allocations.length > 0 && (
        <div className="overflow-hidden rounded-[12px] border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="flex items-center border-b border-[#ededed] bg-[#f3f3f3] text-[13px] tracking-[0.02em] text-[#7c7c7c]">
                  <th className="flex h-9 w-9 items-center justify-center border-r border-[#ededed]">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      aria-label="Select all allocations"
                      className="h-3.5 w-3.5 rounded-[4px] border-border"
                    />
                  </th>
                  <th className="flex h-9 w-9 items-center justify-center border-r border-[#ededed] font-medium">No.</th>
                  <th className="flex h-9 flex-[1.2] items-center px-2 font-medium">Voucher Type</th>
                  <th className="flex h-9 flex-[1.6] items-center border-l border-[#ededed] px-2 font-medium">Voucher No</th>
                  <th className="flex h-9 flex-[1.2] items-center justify-end border-l border-[#ededed] px-2 font-medium">Allocated Amount</th>
                  <th className="flex h-9 w-24 items-center border-l border-[#ededed] px-2 font-medium">Currency</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a, i) => {
                  const k = key(a)
                  return (
                    <tr
                      key={k}
                      className={cn(
                        "flex items-center border-b border-[#ededed] last:border-b-0",
                        selected.has(k) && "bg-primary-50/50"
                      )}
                    >
                      <td className="flex h-10 w-9 items-center justify-center border-r border-[#ededed]">
                        <input
                          type="checkbox"
                          checked={selected.has(k)}
                          onChange={() => toggle(k)}
                          aria-label={`Select ${a.reference_doctype} ${a.reference_name}`}
                          className="h-3.5 w-3.5 rounded-[4px] border-border"
                        />
                      </td>
                      <td className="flex h-10 w-9 items-center justify-center border-r border-[#ededed] text-muted">{i + 1}</td>
                      <td className="flex h-10 flex-[1.2] items-center truncate px-2 text-body">{a.reference_doctype || "—"}</td>
                      <td className="flex h-10 flex-[1.6] items-center truncate border-l border-[#ededed] px-2 text-body">{a.reference_name || "—"}</td>
                      <td className="flex h-10 flex-[1.2] items-center justify-end border-l border-[#ededed] px-2 text-heading tabular-nums">
                        {formatAmount(a.allocated_amount)}
                      </td>
                      <td className="flex h-10 w-24 items-center border-l border-[#ededed] px-2 text-muted">{a.account_currency || "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalFooter>
        <Button variant="secondary" size="sm" onClick={close} disabled={acting}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={confirm} loading={acting} disabled={loading}>
          UnReconcile
        </Button>
      </ModalFooter>
    </Modal>
  )
}