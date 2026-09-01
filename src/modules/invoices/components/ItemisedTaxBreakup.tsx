import { CollapsibleSection } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import type { ItemisedTaxBreakupRow } from "../services";

interface ItemisedTaxBreakupProps {
  rows: ItemisedTaxBreakupRow[];
  /**
   * ERPNext stores a pre-rendered per-item Tax Breakup HTML on the doc
   * (`other_charges_calculation`). We do NOT render that HTML verbatim because
   * it uses Bootstrap classes that are unstyled here; instead the caller builds
   * `rows` from the authoritative server data (`item_wise_tax_detail`). This
   * prop is retained only as a last-resort fallback for drafts that have no
   * computable rows.
   */
  storedHtml?: string;
  isReturn?: boolean;
}

const cellClass =
  "px-3 py-1.5 text-body whitespace-nowrap border-b border-border";
const numCellClass =
  "px-3 py-1.5 text-right tabular-nums text-body whitespace-nowrap border-b border-border";
const headCellClass =
  "px-3 py-2 text-xs font-semibold text-muted bg-gray-50 whitespace-nowrap border-b border-border";
// ERPNext's table-bordered adds a vertical separator between each column.
const colSep = " border-r border-border";

export default function ItemisedTaxBreakup({
  rows,
  storedHtml,
  isReturn = false,
}: ItemisedTaxBreakupProps) {
  // Primary path is the styled table driven by server/derived data. The stored
  // ERPNext HTML (Bootstrap classes) is only a last-resort for drafts with no
  // computable rows, wrapped so the surrounding styled card keeps it tidy.
  if (!rows.length) {
    if (!storedHtml || !storedHtml.trim()) return null;
    return (
      <CollapsibleSection title="Tax Breakup">
        <div className="rounded-lg border border-border p-2 overflow-x-auto">
          <div className="tax-break-up" dangerouslySetInnerHTML={{ __html: storedHtml }} />
        </div>
      </CollapsibleSection>
    );
  }

  // All rows share the same tax columns; ERPNext dedups by description.
  const taxNames = Object.keys(rows[0].taxes);
  const abs = (value: number) => (isReturn ? Math.abs(value) : value);
  const isLastTax = (name: string) => name === taxNames[taxNames.length - 1];

  return (
    <CollapsibleSection title="Tax Breakup">
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr>
              <th className={`${headCellClass}${colSep} text-left`}>Item</th>
              <th className={`${headCellClass}${colSep} text-right`}>
                Taxable Amount
              </th>
              {taxNames.map((name) => (
                <th
                  key={name}
                  className={`${headCellClass}${isLastTax(name) ? "" : colSep} text-right`}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.item}>
                <td className={`${cellClass}${colSep}`}>
                  <span className="font-medium text-heading">{row.itemName || row.item}</span>
                  {row.itemCode && row.itemCode !== row.itemName && (
                    <span className="text-xs text-muted ml-1">({row.itemCode})</span>
                  )}
                </td>
                <td className={`${numCellClass}${colSep}`}>
                  {formatCurrency(abs(row.taxableAmount))}
                </td>
                {taxNames.map((name) => {
                  const tax = row.taxes[name];
                  if (!tax) return <td key={name} className={`${numCellClass}${isLastTax(name) ? "" : colSep}`} />;
                  const showRate = tax.taxRate || !tax.taxAmount;
                  return (
                    <td
                      key={name}
                      className={`${numCellClass}${isLastTax(name) ? "" : colSep}`}
                    >
                      {showRate && <span className="text-muted">({tax.taxRate}%)</span>}{" "}
                      {formatCurrency(abs(tax.taxAmount))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}