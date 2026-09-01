"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid"
import { quotationService, enrichQuotationItem, type Quotation } from "../services"
import type { QuotationItem } from "../types"
import { formatCurrency } from "@/lib/utils"

interface UpdateItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: Quotation
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
  }
}

function emptyRow(): EditableRow {
  return {
    key: `new-${Math.random().toString(36).slice(2, 8)}`,
    item_code: "",
    item_name: "",
    uom: "",
    conversion_factor: 1,
    qty: 1,
    rate: 0,
  }
}

export default function UpdateItemsDialog({
  open,
  onOpenChange,
  doc,
  onUpdated,
}: UpdateItemsDialogProps) {
  const quotationName = doc.name
  const currency = doc.currency
  const company = doc.company

  const [rows, setRows] = useState<EditableRow[]>(() => (doc.items ?? []).map(rowFromItem))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const updateRow = useCallback((key: string, patch: Partial<EditableRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }, [])

  const handleItemCodeSelect = useCallback(
    async (row: EditableRow, value: string) => {
      if (!value) {
        updateRow(row.key, { item_code: "", item_name: "", uom: "", rate: 0 })
        return
      }
      const docItems: QuotationItem[] = rowsRef.current.map((r) => ({
        name: r.docname,
        item_code: r.item_code,
        item_name: r.item_name,
        uom: r.uom,
        conversion_factor: r.conversion_factor ?? 1,
        qty: r.qty ?? 0,
        rate: r.rate ?? 0,
        amount: 0,
        price_list_rate: 0,
        discount_percentage: 0,
        is_free_item: 0,
        is_alternative: 0,
        has_alternative_item: 0,
      }))
      const item = docItems.find((d) => d.name === row.docname && d.item_code === row.item_code) ?? docItems[0]
      if (!item) return
      try {
        const enriched = await enrichQuotationItem(
          { ...doc, items: docItems },
          item,
          value,
          { isNew: false, name: doc.name || "", company: doc.company },
        )
        if (enriched) {
          updateRow(row.key, {
            item_code: enriched.item_code ?? value,
            item_name: enriched.item_name ?? value,
            uom: enriched.uom ?? "",
            conversion_factor: enriched.conversion_factor ?? 1,
            rate: enriched.rate ?? 0,
          })
          return
        }
      } catch {
        // fall through to minimal commit
      }
      updateRow(row.key, { item_code: value, item_name: value })
    },
    [doc, company, updateRow],
  )

  const columns = useMemo<GridColumn<EditableRow>[]>(
    () => [
      {
        key: "item_code",
        label: "Item Code",
        type: "link",
        docType: "Item",
        searchFn: async (q) => {
          const results = await quotationService.searchItemsDesk(q).catch(() => [])
          return {
            items: results.map((r) => ({
              value: r.value,
              label: r.value,
              description: r.description ?? "",
            })),
          }
        },
        onSelect: handleItemCodeSelect,
        placeholder: "Search item…",
        weight: 2.6,
      },
      { key: "qty", label: "Qty", type: "number", align: "right", weight: 0.8 },
      {
        key: "rate",
        label: "Rate",
        type: "number",
        align: "right",
        weight: 1,
        prefix: "$",
        formatter: (row) => formatCurrency(row.rate ?? 0, currency),
      },
    ],
    [handleItemCodeSelect, currency],
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
      setRows((doc.items ?? []).map(rowFromItem))
      setError("")
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogContent
        className="sm:max-w-3xl max-h-[85vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Update Items — {quotationName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
          <ChildTableGrid<EditableRow>
            title="Items"
            rows={rows}
            columns={columns}
            emptyRow={emptyRow()}
            onChange={setRows}
            minWidth="720px"
          />
        </div>

        <div className="flex items-center justify-end border-t border-border pt-3 mt-2">
          {error && <span className="text-xs text-danger-600 mr-2">{error}</span>}
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
