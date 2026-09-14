"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button } from "@/components/ui"

interface DeliveryDatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dates: string[]
  onConfirm: (dates: string[]) => void
}

function displayDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

// ERPNext `make_delivery_note_based_on_delivery_date` (sales_order.js): when
// the SO spans multiple distinct item delivery dates a date checkbox list is
// shown; the picked dates are forwarded to make_delivery_note(delivery_dates).
export default function DeliveryDatesDialog({ open, onOpenChange, dates, onConfirm }: DeliveryDatesDialogProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    setSelected(Object.fromEntries(dates.map((date) => [date, true])))
  }, [open, dates])

  const handleConfirm = () => {
    const chosen = dates.filter((date) => selected[date])
    onConfirm(chosen)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Items based on Delivery Date</DialogTitle>
        </DialogHeader>

        <div className="border border-border rounded-lg divide-y divide-border/50">
          <div className="px-4 py-2 text-xs font-semibold text-muted">Delivery Date</div>
          {dates.map((date) => (
            <label
              key={date}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors text-sm text-body"
            >
              <input
                type="checkbox"
                checked={!!selected[date]}
                onChange={(e) => setSelected((prev) => ({ ...prev, [date]: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              {displayDate(date)}
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Select</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}