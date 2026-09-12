"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid"
import {
  salesOrderService,
  enrichSalesOrderItem,
  type SalesOrderDoc,
} from "../services"
import type { SalesOrderItemForm } from "../types"
import { formatCurrency } from "@/lib/utils"

interface UpdateItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: SalesOrderDoc
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

function rowFromItem(item: SalesOrderItemForm): EditableRow {
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
  const soName = doc.name
  const currency = doc.currency

  const [rows, setRows] = useState<EditableRow[]>(() => (doc.items ?? []).map(rowFromItem))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  // Re-sync the editable rows from the latest doc each time the dialog is
  // (re)opened, so edits made through an earlier session always show up.
  const prevOpen = useRef(open)
  useEffect(() => {
    if (open && !prevOpen.current) {
      setRows((doc.items ?? []).map(rowFromItem))
      setError("")
    }
    prevOpen.current = open
  }, [open, doc])

  const updateRow = useCallback((key: string, patch: Partial<EditableRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }, [])

  const handleItemCodeSelect = useCallback(
    async (row: EditableRow, value: string) => {
      if (!value) {
        updateRow(row.key, { item_code: "", item_name: "", uom: "", rate: 0 })
        return
      }
      // Mirror the quotation Update Items dialog: enrich against the CURRENT
      // ledger of dialog rows (so new rows and in-progress edits are included
      // in the desk doc envelope) via the shared enrichSalesOrderItem helper.
      const docItems: SalesOrderItemForm[] = rowsRef.current.map((r) => ({
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
        delivered_by_supplier: 0,
        reserve_stock: 0,
      }))
      const item = docItems.find((d) => d.name === row.docname && d.item_code === row.item_code) ?? docItems[0]
      if (!item) return
      try {
        const enriched = await enrichSalesOrderItem(
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
        // fall through to minimal commit below
      }
      updateRow(row.key, { item_code: value, item_name: value })
    },
    [doc, updateRow],
  )

  const columns = useMemo<GridColumn<EditableRow>[]>(
    () => [
      {
        key: "item_code",
        label: "Item Code",
        type: "link",
        docType: "Item",
        searchFn: async (q) => {
          const results = await salesOrderService.searchItemsDesk(q).catch(() => [])
          return {
            items: results.map((r) => ({
              value: r.value,
              label: r.value,
              description: r.description ?? "",
            })),
          }
        },
        onSelect: handleItemCodeSelect,
        placeholder: "Search item\u2026",
        weight: 2.6,
      },
      { key: "qty", label: "Qty", type: "number", align: "right", weight: 0.8 },
      {
        key: "rate",
        label: "Rate",
        type: "number",
        align: "right",
        weight: 1,
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
      await salesOrderService.updateChildQtyRate(soName, transItems)
      onOpenChange(false)
    } catch (e) {
      // ERPNext's update_child_qty_rate persists child rows and only then runs
      // post-save validations (validate_selling_price, check_credit_limit, ...),
      // so a thrown error may still have partially saved the doc. Always reload
      // the main form so it mirrors the server state; keep the dialog open on
      // failure so the user can correct qty/rate and retry.
      setError(e instanceof Error ? e.message : "Failed to update items.")
    } finally {
      onUpdated()
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
          <DialogTitle>Update Items — {soName}</DialogTitle>
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
