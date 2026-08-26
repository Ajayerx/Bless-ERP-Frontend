"use client"

import { useState, useCallback } from "react"
import { Badge } from "@/components/ui"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import type { QuotationItem } from "../types"
import { formatCurrency } from "@/lib/utils"

interface AlternativeItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: QuotationItem[]
  currency: string
  onContinue: (selectedItems: Array<{ name: string; item_code: string; is_alternative: number }>) => void
}

export default function AlternativeItemsDialog({
  open,
  onOpenChange,
  items,
  currency,
  onContinue,
}: AlternativeItemsDialogProps) {
  const relevantItems = items.filter(
    (item) => item.is_alternative || item.has_alternative_item,
  )

  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const item of relevantItems) {
      if (item.name) initial.add(item.name)
    }
    return initial
  })

  const toggle = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }, [])

  const handleContinue = () => {
    const selectedItems = relevantItems
      .filter((item) => item.name && selected.has(item.name))
      .map((item) => ({
        name: item.name!,
        item_code: item.item_code ?? "",
        is_alternative: item.is_alternative,
      }))
    onContinue(selectedItems)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Alternative Items for Sales Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />
            Alternative Items
          </p>
          <p className="text-xs text-muted">
            Select an item from each set to be included in the Sales Order.
          </p>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-secondary text-left text-xs text-muted">
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2">Item Code</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {relevantItems.map((item) => (
                  <tr
                    key={item.name}
                    className="border-t border-border hover:bg-gray-50/50"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!item.name && selected.has(item.name)}
                        onChange={() => item.name && toggle(item.name)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {item.is_alternative ? (
                        <Badge variant="warning" className="text-xs">
                          {item.item_code}
                        </Badge>
                      ) : (
                        <span className="font-medium">{item.item_code}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted truncate max-w-[200px]">
                      {item.description || item.item_name}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(item.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleContinue}
            disabled={selected.size === 0}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
