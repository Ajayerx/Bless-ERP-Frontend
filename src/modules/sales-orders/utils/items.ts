import type { SalesOrderItemForm } from "../types"

// A row counts as "filled" if it carries any real data. Pure placeholder rows
// (the default first grid row) have no item_code, item_name or description and
// must be dropped when mapped items are merged in (Get Items From), otherwise
// the grid shows a blank first row with the fetched items starting from row 2.
export function isFilledItemRow(row: SalesOrderItemForm): boolean {
  return Boolean(row.item_code || row.item_name || row.description)
}