"use client"

import { useState, useCallback } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import { LinkSearchField } from "@/components/ui"
import { quotationService, type QuotationItem } from "../services"
import { formatCurrency } from "@/lib/utils"

interface UpdateItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: QuotationItem[]
  quotationName: string
  currency: string
  company: string
  onUpdated: () => void
}

interface EditableRow {
  key: string
  docname?: string
  item_code: string
  item_name: string
  uom: string
  conversion_factor: number
  qty: number
  rate: number
  amount: number
}

function rowFromItem(item: QuotationItem): EditableRow {
  return {
    key: item.name ?? `new-${Math.random().toString(36).slice(2, 8)}`,
    docname: item.name,
    item_code: item.item_code ?? "",
    item_name: item.item_name ?? "",
    uom: item.uom ?? "",
    conversion_factor: item.conversion_factor ?? 1,
    qty: item.qty ?? 0,
    rate: item.rate ?? 0,
    amount: item.amount ?? 0,
  }
}

function emptyRow(): EditableRow {
  return {
    key: `new-${Math.random().toString(36).slice(2, 8)}`,
    item_code: "",
    item_name: "",
    uom: "",
    conversion_factor: 1,
    qty: 0,
    rate: 0,
    amount: 0,
  }
}

export default function UpdateItemsDialog({
  open,
  onOpenChange,
  items,
  quotationName,
  currency,
  company,
  onUpdated,
}: UpdateItemsDialogProps) {
  const [rows, setRows] = useState<EditableRow[]>(() => items.map(rowFromItem))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const updateRow = useCallback((key: string, patch: Partial<EditableRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        const next = { ...r, ...patch }
        if (patch.qty !== undefined || patch.rate !== undefined) {
          next.amount = next.qty * next.rate
        }
        return next
      }),
    )
  }, [])

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }, [])

  const handleItemCodeChange = useCallback(
    async (key: string, value: string | null) => {
      if (!value) {
        updateRow(key, { item_code: "", item_name: "", uom: "", rate: 0, amount: 0 })
        return
      }
      try {
        const details = await quotationService.getItemDetails(
          {
            item_code: value,
            transaction_date: new Date().toISOString().slice(0, 10),
            currency,
          },
          company,
        )
        updateRow(key, {
          item_code: value,
          item_name: details.item_name ?? value,
          uom: details.uom ?? "",
          conversion_factor: details.conversion_factor ?? 1,
          rate: details.rate ?? 0,
          amount: (details.rate ?? 0) * (rows.find((r) => r.key === key)?.qty ?? 0),
        })
      } catch {
        updateRow(key, { item_code: value, item_name: value })
      }
    },
    [currency, company, rows, updateRow],
  )

  const handleUomChange = useCallback(
    async (key: string, value: string | null) => {
      if (!value) return
      const row = rows.find((r) => r.key === key)
      if (!row || !row.item_code) {
        updateRow(key, { uom: value })
        return
      }
      try {
        const factor = await quotationService.getConversionFactor(row.item_code, value)
        updateRow(key, { uom: value, conversion_factor: factor })
      } catch {
        updateRow(key, { uom: value })
      }
    },
    [rows, updateRow],
  )

  const handleSubmit = async () => {
    const valid = rows.filter((r) => r.item_code.trim())
    if (valid.length === 0) {
      setError("Add at least one item.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const transItems = valid.map((r) => ({
        docname: r.docname,
        item_code: r.item_code,
        qty: r.qty,
        rate: r.rate,
        uom: r.uom,
        conversion_factor: r.conversion_factor,
      }))
      await quotationService.updateChildQtyRate(quotationName, transItems)
      onOpenChange(false)
      onUpdated()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update items.")
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setRows(items.map(rowFromItem))
      setError("")
    }
    onOpenChange(nextOpen)
  }

  const total = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Update Items — {quotationName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="text-left py-2 font-semibold w-[30%]">Item Code</th>
                <th className="text-left py-2 font-semibold w-[15%]">UOM</th>
                <th className="text-right py-2 font-semibold w-[12%]">Qty</th>
                <th className="text-right py-2 font-semibold w-[15%]">Rate</th>
                <th className="text-right py-2 font-semibold w-[18%]">Amount</th>
                <th className="w-[5%]"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-border/50">
                  <td className="py-1.5">
                    <LinkSearchField
                      value={row.item_code || undefined}
                      onChange={(v) => handleItemCodeChange(row.key, v)}
                      searchFn={(q) =>
                        quotationService.searchItemsDesk(q).then((items) => ({
                          items: items.map((i) => ({ value: i.value, label: i.value, description: i.description })),
                        }))
                      }
                      placeholder="Search item..."
                      clearIconMode="hover"
                      className="w-full"
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="text"
                      value={row.uom}
                      onChange={(e) => handleUomChange(row.key, e.target.value || null)}
                      className="w-full h-8 px-2 text-sm rounded-lg border border-border bg-surface text-heading focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      value={row.qty || ""}
                      onChange={(e) => updateRow(row.key, { qty: parseFloat(e.target.value) || 0 })}
                      className="w-full h-8 px-2 text-sm text-right rounded-lg border border-border bg-surface text-heading focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      min={0}
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      value={row.rate || ""}
                      onChange={(e) => updateRow(row.key, { rate: parseFloat(e.target.value) || 0 })}
                      className="w-full h-8 px-2 text-sm text-right rounded-lg border border-border bg-surface text-heading focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      min={0}
                    />
                  </td>
                  <td className="py-1.5 text-right text-sm font-medium tabular-nums text-heading pr-2">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="p-1 text-muted hover:text-danger-600 transition-colors rounded"
                      title="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            <Plus size={13} /> Add Row
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 mt-2">
          <span className="text-sm font-semibold text-heading">
            Total: {formatCurrency(total)}
          </span>
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-xs text-danger-600 mr-2">{error}</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Updating..." : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
