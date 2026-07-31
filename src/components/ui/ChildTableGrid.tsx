"use client";

import { useEffect, useState } from "react";
import LinkSearchField from "./LinkSearchField";
import { cn } from "@/lib/utils";

const checkedCache = new Map<string, Set<number>>();

export interface GridColumn<T> {
  key: keyof T;
  label: string;
  type: "link" | "text" | "number" | "checkbox" | "readonly";
  options?: string[];
  searchFn?: (query: string) => Promise<{ items: { value: string; label: string; description: string }[] }>;
  validate?: (value: string) => Promise<void>;
  docType?: string;
}

interface ChildTableGridProps<T> {
  title: string;
  description?: string;
  rows: T[];
  columns: GridColumn<T>[];
  emptyRow: T;
  onChange: (rows: T[]) => void;
}

export default function ChildTableGrid<T extends object>({
  title,
  description,
  rows,
  columns,
  emptyRow,
  onChange,
}: ChildTableGridProps<T>) {
  const cacheKey = `${title}::${(rows as unknown as Record<string, unknown>[]).map((r) => String(r.name ?? "")).join("|")}`;
  const [checked, setChecked] = useState<Set<number>>(() => {
    const cached = checkedCache.get(cacheKey);
    return cached ? new Set(cached) : new Set();
  });

  const commitChecked = (next: Set<number>) => {
    checkedCache.set(cacheKey, next);
    setChecked(next);
  };

  useEffect(() => {
    setChecked((prev) => {
      const next = new Set([...prev].filter((i) => i < rows.length));
      checkedCache.set(cacheKey, next);
      return next;
    });
  }, [rows.length, cacheKey]);

  const updateCell = (idx: number, key: keyof T, value: unknown) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };
  const addRow = () => onChange([...rows, { ...emptyRow }]);
  const toggleRow = (idx: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      checkedCache.set(cacheKey, next);
      return next;
    });
  const toggleAll = () => {
    if (checked.size === rows.length) commitChecked(new Set());
    else commitChecked(new Set(rows.map((_, i) => i)));
  };
  const removeChecked = () => {
    onChange(rows.filter((_, i) => !checked.has(i)));
    commitChecked(new Set());
  };

  const allChecked = rows.length > 0 && checked.size === rows.length;

  const cellInputClass =
    "w-full h-[38px] bg-transparent border-0 rounded-none px-1 text-[13px] text-body focus:outline-none focus:ring-0";

  return (
    <div className="pt-4 border-t border-border">
      <div className="mb-3">
        <p className="text-base font-bold text-heading">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px] overflow-hidden rounded-[10px] border border-[#ededed] bg-surface">
          <div className="flex items-center border-b border-[#ededed] bg-[#f3f3f3] text-[13px] tracking-[0.02em] text-[#7c7c7c]">
            <div className="flex h-8 w-9 items-center justify-center border-r border-[#ededed]">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="h-3.5 w-3.5 rounded-[4px] border-border"
                aria-label="Select all rows"
              />
            </div>
            <div className="flex h-8 w-9 items-center justify-center border-r border-[#ededed]">No.</div>
            {columns.map((col, ci) => (
              <div
                key={String(col.key)}
                className={cn(
                  "flex h-8 flex-1 items-center px-2 py-1.5",
                  ci < columns.length - 1 && "border-r border-[#ededed]"
                )}
              >
                {col.label}
              </div>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-2 py-4 text-[13px] text-[#7c7c7c]">
              No Data
            </div>
          ) : (
            rows.map((row, idx) => (
              <div
                key={String((row as Record<string, unknown>).name ?? idx)}
                className="flex min-h-[38px] border-b border-[#ededed] last:border-b-0"
              >
                <div className="flex w-9 items-center justify-center border-r border-[#ededed]">
                  <input
                    type="checkbox"
                    checked={checked.has(idx)}
                    onChange={() => toggleRow(idx)}
                    className="h-3.5 w-3.5 rounded-[4px] border-border"
                    aria-label={`Select row ${idx + 1}`}
                  />
                </div>
                <div className="flex w-9 items-center justify-center border-r border-[#ededed] text-[13px] text-[#7c7c7c]">
                  {idx + 1}
                </div>
                {columns.map((col, ci) => (
                  <div
                    key={String(col.key)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center px-2",
                      ci < columns.length - 1 && "border-r border-[#ededed]"
                    )}
                  >
                    {col.type === "link" && col.searchFn ? (
                      <LinkSearchField
                        value={(row[col.key] as string) ?? ""}
                        onChange={(v) => updateCell(idx, col.key, v ?? "")}
                        searchFn={col.searchFn}
                        validate={col.validate}
                        docType={col.docType ?? ""}
                        placeholder="Search..."
                        inputClassName="border-0 bg-transparent rounded-none px-0 pr-8 py-2.5 text-[13px] focus:ring-0"
                      />
                    ) : col.type === "link" ? (
                      <select
                        value={(row[col.key] as string) ?? ""}
                        onChange={(e) => updateCell(idx, col.key, e.target.value)}
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
                        onChange={(e) => updateCell(idx, col.key, e.target.value)}
                        className={cellInputClass}
                      />
                    ) : col.type === "number" ? (
                      <input
                        type="number"
                        value={(row[col.key] as number) ?? 0}
                        onChange={(e) => updateCell(idx, col.key, Number(e.target.value))}
                        className={cellInputClass}
                      />
                    ) : col.type === "checkbox" ? (
                      <input
                        type="checkbox"
                        checked={!!row[col.key]}
                        onChange={(e) => updateCell(idx, col.key, e.target.checked ? 1 : 0)}
                        className="h-3.5 w-3.5 rounded-[4px] border-border"
                      />
                    ) : (
                      <span className="text-xs text-muted">
                        {(row[col.key] as string | number) ?? "—"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-1 py-1.5">
        {checked.size > 0 && (
          <button
            type="button"
            onClick={removeChecked}
            className="rounded-[8px] bg-[#e03636] px-2 py-1 text-xs text-white hover:bg-[#d02020]"
          >
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={addRow}
          className="rounded-[8px] bg-[#7c7c7c] px-2 py-1 text-xs text-white hover:bg-[#696969]"
        >
          Add Row
        </button>
      </div>
    </div>
  );
}
