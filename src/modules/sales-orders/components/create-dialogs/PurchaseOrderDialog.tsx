"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, useMessageDialog } from "@/components/ui"
import { salesOrderService } from "../../services"
import type { SalesOrderDoc, SalesOrderItemForm } from "../../types"
import type { CreateOutcome } from "../../config/createTargets"

interface PurchaseOrderRow {
  name: string
  item_code: string
  item_name: string
  pending_qty: number
  uom: string
  supplier?: string
  selected: 0 | 1
}

interface PurchaseOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: SalesOrderDoc
  onCreated: (outcome: CreateOutcome) => void
  onDocCreated?: () => void
}

const GRID_COLS = "28px minmax(110px, 1.2fr) minmax(150px, 1.5fr) 110px 90px minmax(120px, 1fr)"

// ERPNext `get_ordered_qty` (sales_order.js): a product-bundle line is fully
// ordered only when every packed item is itself ordered (unknown = not ordered).
function getOrderedQty(item: SalesOrderItemForm, so: SalesOrderDoc): number {
  if (so.packed_items && so.packed_items.length) {
    const packed = so.packed_items.filter((pi) => pi.item_code === item.item_code)
    if (packed.length) {
      const allOrdered = packed.every((pi) => {
        const orderedQty = Number((pi as unknown as Record<string, unknown>).ordered_qty ?? 0)
        return orderedQty >= Number(pi.qty ?? 0)
      })
      return allOrdered ? (item.stock_qty ?? 0) : 0
    }
  }
  return Number((item as unknown as Record<string, unknown>).ordered_qty ?? 0)
}

function poItemsFromDoc(doc: SalesOrderDoc): PurchaseOrderRow[] {
  const rows: PurchaseOrderRow[] = []
  for (const item of doc.items) {
    const orderedQty = getOrderedQty(item, doc)
    const stockQty = item.stock_qty ?? item.qty * (item.conversion_factor || 1)
    const pendingQty = (stockQty - orderedQty) / (item.conversion_factor || 1)
    if (pendingQty > 0) {
      rows.push({
        name: item.name ?? "",
        item_code: item.item_code ?? "",
        item_name: item.item_name,
        pending_qty: pendingQty,
        uom: item.uom,
        supplier: item.supplier,
        selected: 1,
      })
    }
  }
  return rows
}

// ERPNext `make_purchase_order` dialog (sales_order.js): item table with the
// "Against Default Supplier" toggle — when on, only items that carry a
// supplier are shown. Single PO (unsaved mapped draft) vs per-supplier POs.
export default function PurchaseOrderDialog({ open, onOpenChange, doc, onCreated, onDocCreated }: PurchaseOrderDialogProps) {
  const { showMessage } = useMessageDialog()
  const rows = useMemo(() => poItemsFromDoc(doc), [doc])
  const [againstDefaultSupplier, setAgainstDefaultSupplier] = useState(false)
  const [selected, setSelected] = useState<Record<string, 0 | 1>>({})
  const [submitting, setSubmitting] = useState(false)

  const visibleRows = againstDefaultSupplier ? rows.filter((row) => row.supplier) : rows

  const toggleRow = (name: string) => {
    setSelected((prev) => ({ ...prev, [name]: prev[name] === 1 ? 0 : 1 }))
  }

  const handleCreate = async () => {
    const chosen = visibleRows.filter(
      (row) => (selected[row.name] === undefined ? 1 : selected[row.name]) === 1 && row.pending_qty > 0,
    )
    if (chosen.length === 0) {
      showMessage({ title: "Items Required", message: "Please select Items from the Table", indicator: "blue" })
      return
    }
    const payload = chosen.map((row) => ({
      name: row.name,
      item_code: row.item_code,
      item_name: row.item_name,
      pending_qty: row.pending_qty,
      uom: row.uom,
      supplier: row.supplier,
    }))
    setSubmitting(true)
    try {
      if (againstDefaultSupplier) {
        const body = await salesOrderService.makePurchaseOrderForDefaultSupplier(doc.name, payload)
        const message = (body as Record<string, unknown>)?.message
        const names = (Array.isArray(message) ? message : [])
          .map((d) => String((d as Record<string, unknown>)?.name ?? ""))
          .filter(Boolean)
        onCreated({ doctype: "Purchase Order", names })
      } else {
        const created = await salesOrderService.makePurchaseOrder(doc.name, payload)
        onCreated({ doctype: "Purchase Order", name: created.name })
      }
      onDocCreated?.()
      onOpenChange(false)
    } catch (err) {
      showMessage({ message: err instanceof Error ? err.message : "Failed to create purchase order." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Purchase Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <label className="flex items-center gap-2 text-sm text-body cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={againstDefaultSupplier}
              onChange={(e) => {
                setAgainstDefaultSupplier(e.target.checked)
                setSelected({})
              }}
              className="h-4 w-4 rounded border-border"
            />
            Against Default Supplier
          </label>

          <p className="text-xs text-muted">Select Items</p>
          <div
            className="grid gap-4 px-4 py-2 text-xs font-semibold text-muted border border-b-0 border-border rounded-t-lg"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <span />
            <span>Item</span>
            <span>Item name</span>
            <span>Pending Qty</span>
            <span>UOM</span>
            <span>Supplier</span>
          </div>
          <div className="border border-border rounded-b-lg max-h-72 overflow-y-auto">
            {visibleRows.length === 0 ? (
              <div className="p-4 text-sm text-muted text-center">
                {againstDefaultSupplier
                  ? "No items with a default supplier."
                  : "No items pending purchase."}
              </div>
            ) : (
              visibleRows.map((row) => {
                const isSelected = (selected[row.name] === undefined ? 1 : selected[row.name]) === 1
                return (
                  <div
                    key={row.name}
                    className="grid gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 items-center"
                    style={{ gridTemplateColumns: GRID_COLS }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(row.name)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm text-body font-medium truncate">{row.item_code}</span>
                    <span className="text-sm text-body truncate">{row.item_name}</span>
                    <span className="text-sm text-body tabular-nums">{row.pending_qty.toFixed(2)}</span>
                    <span className="text-sm text-muted">{row.uom}</span>
                    <span className="text-xs text-muted truncate">{row.supplier ?? "—"}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Close
          </Button>
          <Button onClick={() => void handleCreate()} disabled={submitting} loading={submitting}>
            {submitting ? "Creating..." : "Create Purchase Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}