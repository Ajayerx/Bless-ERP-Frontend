"use client"

import { useState } from "react"
import { X, Frown } from "lucide-react"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, LinkSearchField, Textarea } from "@/components/ui"
import { customerService } from "@/modules/customers/services"
import { quotationService } from "../services"

interface SetLostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quotationName: string
  onDeclaredLost: () => void
}

const chipRow = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger-50 text-danger-700 text-xs font-medium"

// ERPNext "Set as Lost" (declare_enquiry_lost): multi-chip Lost Reasons and
// Competitors + optional detailed reason, sent via frappe.desk.form link.
export default function SetLostDialog({ open, onOpenChange, quotationName, onDeclaredLost }: SetLostDialogProps) {
  const [lostReasons, setLostReasons] = useState<string[]>([])
  const [competitors, setCompetitors] = useState<string[]>([])
  const [detailedReason, setDetailedReason] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const addChip = (list: string[], set: (next: string[]) => void, value: string) => {
    const v = value.trim()
    if (!v) return
    if (!list.some((x) => x.toLowerCase() === v.toLowerCase())) {
      set([...list, v])
    }
  }

  const removeChip = (list: string[], set: (next: string[]) => void, value: string) => {
    set(list.filter((x) => x !== value))
  }

  const handleSubmit = async () => {
    if (lostReasons.length === 0) {
      setError("At least one lost reason is required.")
      return
    }
    setSending(true)
    setError("")
    try {
      await quotationService.declareLost(quotationName, {
        lostReasons,
        competitors,
        detailedReason: detailedReason || undefined,
      })
      setDone(true)
      setTimeout(() => {
        onOpenChange(false)
        onDeclaredLost()
      }, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark quotation as lost.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set as Lost — {quotationName}</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-success-600">Quotation marked as Lost!</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-heading block mb-1.5">Lost Reasons *</label>
              {lostReasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {lostReasons.map((reason) => (
                    <span key={reason} className={chipRow}>
                      {reason}
                      <button
                        type="button"
                        onClick={() => removeChip(lostReasons, setLostReasons, reason)}
                        title="Remove"
                        className="hover:text-danger-900 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <LinkSearchField
                value={undefined}
                onChange={(v) => {
                  if (v) addChip(lostReasons, setLostReasons, v)
                }}
                searchFn={async (q) => {
                  const results = await customerService.searchLink("Lost Reason", q, "Quotation", {})
                  return { items: results }
                }}
                docType="Lost Reason"
                placeholder="Search lost reason…"
                clearIconMode="hover"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-heading block mb-1.5">Competitors</label>
              {competitors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {competitors.map((competitor) => (
                    <span key={competitor} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-body text-xs font-medium">
                      {competitor}
                      <button
                        type="button"
                        onClick={() => removeChip(competitors, setCompetitors, competitor)}
                        title="Remove"
                        className="hover:text-danger-700 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <LinkSearchField
                value={undefined}
                onChange={(v) => {
                  if (v) addChip(competitors, setCompetitors, v)
                }}
                searchFn={async (q) => {
                  const results = await customerService.searchLink("Competitor", q, "Quotation", {})
                  return { items: results }
                }}
                docType="Competitor"
                placeholder="Search competitor…"
                clearIconMode="hover"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-heading block mb-1.5">Detailed Reason</label>
              <Textarea
                rows={3}
                value={detailedReason}
                onChange={(e) => setDetailedReason(e.target.value)}
                placeholder="Optional details…"
              />
            </div>

            {error && (
              <p className="text-xs text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[8px]">
                {error}
              </p>
            )}
          </div>
        )}

        {!done && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleSubmit} disabled={sending || lostReasons.length === 0}>
              {sending ? <span className="animate-spin">◌</span> : <Frown size={14} />}
              {sending ? "Setting…" : "Set as Lost"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}