import type { LineItemForm } from "../components/InvoiceLineItems"
import { invoiceService } from "../services"

// Mirrors ERPNext's set_warehouse handler (transaction.js set_warehouse ->
// autofill_warehouse): setting the header Source Warehouse cascades to every
// item row's warehouse and, for rows with an item code, fires get_bin_details
// to populate the read-only actual_qty ("Qty (Warehouse)"). Rows whose
// warehouse is unchanged are skipped, matching frappe.model.set_value's
// change-only trigger.
export async function applySetWarehouseToItems(
  lineItems: LineItemForm[],
  updateLine: (id: string, updates: Partial<LineItemForm>) => void,
  warehouse: string | undefined,
): Promise<void> {
  const next = warehouse ?? ""
  for (const row of lineItems) {
    if ((row.warehouse ?? "") === next) continue
    updateLine(row.id, { warehouse: next })
    const itemCode = row.sku || row.productId
    if (itemCode && next) {
      const bin = await invoiceService.getBinDetails(itemCode, next)
      if (bin) updateLine(row.id, { actualQty: bin.actual_qty })
    }
  }
}
