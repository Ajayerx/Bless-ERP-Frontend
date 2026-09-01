"use client";

import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid";
import { formatCurrency } from "@/lib/utils";
import type { ChargeType, EditableTaxRow } from "../types";
import { createEmptyTaxRow, invoiceService } from "../services";

const CHARGE_TYPES: ChargeType[] = [
  "Actual",
  "On Net Total",
  "On Previous Row Amount",
  "On Previous Row Total",
  "On Item Quantity",
];

interface SalesTaxesChargesTableProps {
  rows: EditableTaxRow[];
  currency: string;
  company?: string;
  readOnly: boolean;
  noTopBorder?: boolean;
  onChange?: (rows: EditableTaxRow[]) => void;
  chargeTypeOptions?: ChargeType[];
}

/**
 * ERPNext-exact "Sales Taxes and Charges" child table, shared by Sales Invoice,
 * Sales Order and Quotation (mirrors erpnext.accounts.taxes in ERPNext).
 */
export default function SalesTaxesChargesTable({
  rows,
  currency,
  company = "",
  readOnly,
  noTopBorder,
  onChange,
  chargeTypeOptions = CHARGE_TYPES,
}: SalesTaxesChargesTableProps) {
  const isEditable = !!onChange && !readOnly;
  const chargeTypes = chargeTypeOptions as ChargeType[];

  const handleTaxRowsChange = (next: EditableTaxRow[]) => {
    if (!onChange || readOnly) return
    onChange(next)
    next.forEach((row, i) => {
      const old = rows[i]
      if (
        old &&
        row.account_head &&
        row.account_head !== old.account_head &&
        row.charge_type !== "Actual"
      ) {
        const withDesc = next.map((r, j) =>
          j === i ? { ...r, description: row.account_head } : r
        )
        invoiceService.getTaxRate(row.account_head).then((result) => {
          if (result.tax_rate > 0 && onChange) {
            onChange(
              withDesc.map((r, j) =>
                j === i
                  ? { ...r, rate: result.tax_rate, description: result.account_name || r.description }
                  : r
              )
            )
          }
        })
      }
    })
  }

  const taxColumns: GridColumn<EditableTaxRow>[] = [
    {
      key: "charge_type",
      label: "Type",
      type: "link",
      options: chargeTypes,
      weight: 1.4,
    },
    {
      key: "account_head",
      label: "Account Head",
      type: "link",
      searchFn: (q) => invoiceService.searchTaxAccounts(q, company),
      docType: "Account",
      placeholder: "Select account…",
      disabled: (row) => !row.charge_type,
      weight: 2.6,
    },
    {
      key: "rate",
      label: "Tax Rate",
      type: "number",
      align: "right",
      disabled: (row) => row.charge_type === "Actual",
      weight: 1,
    },
    {
      key: "tax_amount",
      label: `Amount (${currency})`,
      type: "number",
      align: "right",
      disabled: (row) => row.charge_type !== "Actual",
      formatter: (r) => formatCurrency(r.tax_amount),
      weight: 1.4,
    },
    {
      key: "total",
      label: `Total (${currency})`,
      type: "readonly",
      align: "right",
      formatter: (r) => formatCurrency(r.total),
      weight: 1.4,
    },
  ]

  return (
    <ChildTableGrid<EditableTaxRow>
      title="Sales Taxes and Charges"
      titleClassName="text-xs font-semibold text-muted"
      description={
        isEditable
          ? "Select an Account Head to auto-fill the tax rate."
          : undefined
      }
      rows={rows}
      columns={taxColumns}
      emptyRow={createEmptyTaxRow()}
      onChange={handleTaxRowsChange}
      readOnly={readOnly}
      noTopBorder={noTopBorder}
      canDelete={() => rows.length > 1}
      testId="taxes_grid"
      minWidth="720px"
    />
  )
}