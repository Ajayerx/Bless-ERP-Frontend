"use client";

import { Trash2, Plus } from "lucide-react";
import LinkSearchField from "./LinkSearchField";

export interface GridColumn<T> {
  key: keyof T;
  label: string;
  type: "link" | "text" | "number" | "checkbox" | "readonly";
  options?: string[];
  searchFn?: (query: string) => Promise<{ items: { value: string; label: string; description: string }[] }>;
}

interface ChildTableGridProps<T> {
  title: string;
  rows: T[];
  columns: GridColumn<T>[];
  emptyRow: T;
  onChange: (rows: T[]) => void;
}

export default function ChildTableGrid<T extends object>({
  title,
  rows,
  columns,
  emptyRow,
  onChange,
}: ChildTableGridProps<T>) {
  const updateCell = (idx: number, key: keyof T, value: unknown) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };
  const addRow = () => onChange([...rows, { ...emptyRow }]);
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));

  const cellInputClass =
    "w-full px-2 py-1.5 bg-white border border-border rounded-[8px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500";

  return (
    <div className="pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-heading">{title}</p>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
        >
          <Plus size={14} /> Add Row
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted">No rows yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-muted uppercase tracking-wider">
                {columns.map((col) => (
                  <th key={String(col.key)} className="pb-2 pr-3 font-semibold">
                    {col.label}
                  </th>
                ))}
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                    key={String((row as Record<string, unknown>).name ?? idx)}
                  className="border-t border-border"
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="py-2 pr-3 align-top">
                      {col.type === "link" && col.searchFn ? (
                        <div className="w-40">
                          <LinkSearchField
                            value={(row[col.key] as string) ?? ""}
                            onChange={(v) => updateCell(idx, col.key, v ?? "")}
                            searchFn={col.searchFn}
                            docType={String(col.key)}
                            placeholder="Search..."
                            inputClassName="text-xs px-2 py-1.5"
                          />
                        </div>
                      ) : col.type === "link" ? (
                        <select
                          value={(row[col.key] as string) ?? ""}
                          onChange={(e) =>
                            updateCell(idx, col.key, e.target.value)
                          }
                          className={cellInputClass}
                        >
                          <option value="">Select…</option>
                          {(col.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : col.type === "text" ? (
                        <input
                          value={(row[col.key] as string) ?? ""}
                          onChange={(e) =>
                            updateCell(idx, col.key, e.target.value)
                          }
                          className={cellInputClass}
                        />
                      ) : col.type === "number" ? (
                        <input
                          type="number"
                          value={(row[col.key] as number) ?? 0}
                          onChange={(e) =>
                            updateCell(idx, col.key, Number(e.target.value))
                          }
                          className={cellInputClass}
                        />
                      ) : col.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={!!row[col.key]}
                          onChange={(e) =>
                            updateCell(idx, col.key, e.target.checked ? 1 : 0)
                          }
                          className="h-4 w-4 rounded border-border"
                        />
                      ) : (
                        <span className="text-xs text-muted">
                          {(row[col.key] as string | number) ?? "—"}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="py-2 align-top">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="text-danger-600 hover:text-danger-700"
                      aria-label="Remove row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
