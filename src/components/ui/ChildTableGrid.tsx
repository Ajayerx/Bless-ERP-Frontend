"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import LinkSearchField from "./LinkSearchField";
import { cn } from "@/lib/utils";

const checkedCache = new Map<string, Set<number>>();

export interface GridColumn<T> {
  key: keyof T;
  label: string;
  type: "link" | "text" | "number" | "checkbox" | "readonly";
  options?: string[];
  searchFn?: (query: string, row?: T) => Promise<{ items: { value: string; label: string; description: string }[] }>;
  validate?: (value: string, row?: T) => Promise<void>;
  docType?: string | ((row: T) => string);
  disabled?: (row: T) => boolean;
  placeholder?: string;
  render?: (row: T) => ReactNode;
  formatter?: (row: T) => ReactNode;
  weight?: number;
  align?: "left" | "right";
}

interface ChildTableGridProps<T> {
  title: string;
  titleClassName?: string;
  description?: string;
  rows: T[];
  columns: GridColumn<T>[];
  emptyRow: T;
  onChange: (rows: T[]) => void;
  readOnly?: boolean;
  footer?: ReactNode;
  testId?: string;
  canDelete?: (row: T) => boolean;
  onDeleteBlocked?: (blocked: T[]) => void;
  minWidth?: string;
}

export default function ChildTableGrid<T extends object>({
  title,
  titleClassName = "text-sm font-semibold text-heading",
  description,
  rows,
  columns,
  emptyRow,
  onChange,
  readOnly = false,
  footer,
  testId,
  canDelete,
  onDeleteBlocked,
  minWidth = "560px",
}: ChildTableGridProps<T>) {
  const cacheKey = `${title}::${(rows as unknown as Record<string, unknown>[]).map((r) => String(r.name ?? "")).join("|")}`;
  const [checked, setChecked] = useState<Set<number>>(() => {
    const cached = checkedCache.get(cacheKey);
    return cached ? new Set(cached) : new Set();
  });
  const [editableIdx, setEditableIdx] = useState<number | null>(null);

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

  // ERPNext-style row editing: cells show static text until a row is activated.
  // Clamp the active index when rows are removed.
  useEffect(() => {
    setEditableIdx((prev) => (prev != null && prev >= rows.length ? null : prev));
  }, [rows.length]);

  const updateCell = (idx: number, key: keyof T, value: unknown) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };
  const addRow = () => {
    onChange([...rows, { ...emptyRow }]);
    setEditableIdx(rows.length);
  };
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
    const blocked = rows.filter((_, i) => checked.has(i) && canDelete && !canDelete(rows[i]));
    if (blocked.length) {
      onDeleteBlocked?.(blocked);
      commitChecked(new Set());
      return;
    }
    onChange(rows.filter((_, i) => !checked.has(i)));
    commitChecked(new Set());
  };

  const allChecked = rows.length > 0 && checked.size === rows.length;

  const cellInputClass =
    "w-full h-[38px] bg-transparent border-0 rounded-none px-1 text-[13px] text-body focus:outline-none focus:ring-0 disabled:opacity-60";

  return (
    <div className="pt-4 border-t border-border" data-testid={testId}>
      <div className="mb-3">
        <p className={titleClassName}>{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px] overflow-hidden rounded-[10px] border border-[#ededed] bg-surface" style={{ minWidth }}>
          <div className="flex items-center border-b border-[#ededed] bg-[#f3f3f3] text-[13px] tracking-[0.02em] text-[#7c7c7c]">
            <div className="flex h-8 w-9 items-center justify-center border-r border-[#ededed]">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                disabled={readOnly}
                className="h-3.5 w-3.5 rounded-[4px] border-border"
                aria-label="Select all rows"
              />
            </div>
            <div className="flex h-8 w-9 items-center justify-center border-r border-[#ededed]">No.</div>
            {columns.map((col, ci) => (
              <div
                key={String(col.key)}
                style={{ flexGrow: col.weight ?? 1, flexShrink: 1, flexBasis: 0 }}
                className={cn(
                  "flex h-8 items-center overflow-hidden whitespace-nowrap px-2 py-1.5",
                  col.align === "right" && "justify-end",
                  ci < columns.length - 1 && "border-r border-[#ededed]"
                )}
                title={String(col.label)}
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
            rows.map((row, idx) => {
              const isActive = !readOnly && editableIdx === idx;
              const activate = () => {
                if (!readOnly) setEditableIdx(idx);
              };
              const isEditable = (col: GridColumn<T>) =>
                col.type !== "readonly" &&
                col.type !== "checkbox" &&
                !col.disabled?.(row);
              return (
                <div
                  key={String((row as Record<string, unknown>).name ?? idx)}
                  onClick={activate}
                  className={cn(
                    "flex min-h-[38px] border-b border-[#ededed] last:border-b-0",
                    !readOnly && "cursor-pointer",
                    isActive && "bg-primary-50/40"
                  )}
                >
                  <div className="flex w-9 items-center justify-center border-r border-[#ededed]">
                    <input
                      type="checkbox"
                      checked={checked.has(idx)}
                      onChange={() => toggleRow(idx)}
                      disabled={readOnly}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5 rounded-[4px] border-border"
                      aria-label={`Select row ${idx + 1}`}
                    />
                  </div>
                  <div className="flex w-9 items-center justify-center border-r border-[#ededed] text-[13px] text-[#7c7c7c]">
                    {idx + 1}
                  </div>
                  {columns.map((col, ci) => {
                    const interactive = isActive && isEditable(col);
                    return (
                      <div
                        key={String(col.key)}
                        data-testid={testId ? `${testId}_${idx}_${String(col.key)}` : undefined}
                        className={cn(
                          "flex min-w-0 items-center px-2",
                          col.align === "right" && "justify-end",
                          ci < columns.length - 1 && "border-r border-[#ededed]"
                        )}
                        style={{ flexGrow: col.weight ?? 1, flexShrink: 1, flexBasis: 0 }}
                      >
                        {col.type === "checkbox" ? (
                          readOnly ? (
                            <span className="text-xs text-muted">
                              {row[col.key] ? "✓" : "—"}
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={!!row[col.key]}
                              onChange={(e) => updateCell(idx, col.key, e.target.checked ? 1 : 0)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-3.5 w-3.5 rounded-[4px] border-border"
                            />
                          )
                        ) : col.type === "link" && col.searchFn && interactive ? (
                          <LinkSearchField
                            value={(row[col.key] as string) ?? ""}
                            onChange={(v) => updateCell(idx, col.key, v ?? "")}
                            searchFn={(q) => col.searchFn!(q, row)}
                            validate={col.validate ? (v) => col.validate!(v, row) : undefined}
                            docType={typeof col.docType === "function" ? col.docType(row) : (col.docType ?? "")}
                            placeholder={col.placeholder ?? col.label}
                            disabled={col.disabled?.(row) || readOnly}
                            clearIconMode="hover"
                            inputClassName="border-0 bg-transparent rounded-none px-0 pr-8 py-2.5 text-[13px] focus:ring-0"
                          />
                        ) : col.type === "link" && interactive ? (
                          <select
                            value={(row[col.key] as string) ?? ""}
                            onChange={(e) => updateCell(idx, col.key, e.target.value)}
                            disabled={col.disabled?.(row) || readOnly}
                            className={cellInputClass}
                          >
                            <option value="">Select…</option>
                            {(col.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : col.type === "text" && interactive ? (
                          <input
                            type="text"
                            value={(row[col.key] as string) ?? ""}
                            onChange={(e) => updateCell(idx, col.key, e.target.value)}
                            disabled={col.disabled?.(row) || readOnly}
                            placeholder={col.placeholder ?? col.label}
                            className={cellInputClass}
                          />
                        ) : col.type === "number" && interactive ? (
                          <input
                            type="number"
                            value={(row[col.key] as number) || ""}
                            onChange={(e) => updateCell(idx, col.key, Number(e.target.value))}
                            disabled={col.disabled?.(row) || readOnly}
                            placeholder={col.placeholder ?? col.label}
                            className={cn(cellInputClass, col.align === "right" && "text-right")}
                          />
                        ) : col.render ? (
                          col.render(row)
                        ) : col.type === "number" ? (
                          <span className="text-xs tabular-nums text-body">
                            {col.formatter ? col.formatter(row) : ((row[col.key] as number) ?? "—")}
                          </span>
                        ) : col.formatter ? (
                          <span className="text-xs tabular-nums text-body truncate">
                            {col.formatter(row)}
                          </span>
                        ) : (
                          <span className="text-xs text-body truncate">
                            {String((row[col.key] as string | number) ?? "—")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-1 py-1.5">
        {!readOnly && checked.size > 0 && (
          <button
            type="button"
            onClick={removeChecked}
            className="rounded-[8px] bg-[#e03636] px-2 py-1 text-xs text-white hover:bg-[#d02020]"
          >
            Delete
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={addRow}
            data-testid={testId ? `${testId}_add_row` : undefined}
            className="rounded-[8px] bg-[#7c7c7c] px-2 py-1 text-xs text-white hover:bg-[#696969]"
          >
            Add Row
          </button>
        )}
        {footer}
      </div>
    </div>
  );
}
