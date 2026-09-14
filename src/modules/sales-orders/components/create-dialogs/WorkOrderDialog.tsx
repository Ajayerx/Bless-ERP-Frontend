"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, useMessageDialog } from "@/components/ui"
import LinkSearchField from "@/components/ui/LinkSearchField"
import { salesOrderService } from "../../services"
import type { SalesOrderDoc } from "../../types"

interface WorkOrderRow {
  name: string
  item_code: string
  description?: string
  bom: string
  pending_qty: number
  warehouse?: string
  sales_order_item: string
  selected: 0 | 1
}

interface WorkOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: SalesOrderDoc
  onCreated: (names: string[]) => void
}

const GRID_COLS = "28px minmax(130px, 1.4fr) minmax(180px, 1.3fr) 110px"

// ERPNext `make_work_order` (sales_order.js): fetch BOM items, pick a BOM +
// qty per line (BOM link filtered by the item), then make_work_orders which
// creates + submits Work Orders server-side and returns their names.
export default function WorkOrderDialog({ open, onOpenChange, doc, onCreated }: WorkOrderDialogProps) {
  const { showMessage } = useMessageDialog()
  const [rows, setRows] = useState<WorkOrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setRows([])
    setLoading(true)
    let cancelled = false
    salesOrderService
      .getWorkOrderItems(doc.name, 0)
      .then((items) => {
        if (cancelled) return
        const available = (items ?? []).map((item) => ({
          name: item.name,
          item_code: item.item_code,
          description: item.description,
          bom: item.bom ?? "",
          pending_qty: item.pending_qty ?? 0,
          warehouse: item.warehouse,
          sales_order_item: item.sales_order_item ?? item.name,
          selected: 1 as const,
        }))
        setRows(available)
        if (available.length === 0) {
          showMessage({
            title: "Work Order not created",
            message: "No Items with Bill of Materials to Manufacture",
            indicator: "orange",
          })
          onOpenChange(false)
          return
        }
      })
      .catch((err) => {
        if (cancelled) return
        showMessage({ message: err instanceof Error ? err.message : "Failed to load items to manufacture." })
        onOpenChange(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, doc.name, onOpenChange, showMessage])

  const updateRow = (index: number, patch: Partial<WorkOrderRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const searchBom = async (query: string, itemCode: string) => {
    const found = await salesOrderService.searchWidget({
      doctype: "BOM",
      txt: query,
      filters: { item: itemCode },
      page_length: 10,
    })
    return {
      items: (Array.isArray(found) ? found : []).map((row) => ({
        value: String(row.name),
        label: String(row.name),
        description: "",
      })),
    }
  }

  const handleCreate = async () => {
    const selectedRows = rows.filter((row) => row.selected === 1)
    if (selectedRows.length === 0) {
      showMessage({ title: "Items Required", message: "Please select at least one item to continue", indicator: "blue" })
      return
    }
    const incomplete = selectedRows.find((row) => !row.bom || !(row.pending_qty > 0))
    if (incomplete) {
      showMessage({
        title: "Missing details",
        message: `Please select a BOM and a positive Qty against ${incomplete.item_code}.`,
        indicator: "orange",
      })
      return
    }
    setSubmitting(true)
    try {
      const names = await salesOrderService.makeWorkOrders(
        selectedRows.map((row) => ({
          bom: row.bom,
          item_code: row.item_code,
          pending_qty: row.pending_qty,
          sales_order_item: row.sales_order_item,
          warehouse: row.warehouse,
          description: row.description,
        })),
        doc.name,
        doc.company,
        doc.project,
      )
      onCreated(Array.isArray(names) ? names : [])
      onOpenChange(false)
    } catch (err) {
      showMessage({ message: err instanceof Error ? err.message : "Failed to create work orders." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Items to Manufacture</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Loading items...
          </div>
        ) : (
          <div className="space-y-1.5 py-2">
            <p className="text-xs text-muted">Select BOM and Qty for Production</p>
            <div
              className="grid gap-4 px-4 py-2 text-xs font-semibold text-muted border border-b-0 border-border rounded-t-lg"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <span />
              <span>Item Code</span>
              <span>Select BOM</span>
              <span>Qty</span>
            </div>
            <div className="border border-border rounded-b-lg max-h-72 overflow-y-auto">
              {rows.map((row, index) => (
                <div
                  key={row.name}
                  className="grid gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 items-center"
                  style={{ gridTemplateColumns: GRID_COLS }}
                >
                  <input
                    type="checkbox"
                    checked={row.selected === 1}
                    onChange={(e) => updateRow(index, { selected: e.target.checked ? 1 : 0 })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm text-body font-medium truncate">{row.item_code}</span>
                  <LinkSearchField
                    value={row.bom}
                    onChange={(bom) => updateRow(index, { bom: bom ?? "" })}
                    searchFn={(q) => searchBom(q, row.item_code)}
                    placeholder="Select BOM..."
                    docType="BOM"
                    suppressExternalLabelFetch
                  />
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={row.pending_qty}
                    onChange={(e) => updateRow(index, { pending_qty: Number(e.target.value) })}
                    className="w-full px-2.5 py-2 bg-white border border-border rounded-lg text-sm text-body tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Close
          </Button>
          <Button onClick={() => void handleCreate()} disabled={loading || submitting} loading={submitting}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}