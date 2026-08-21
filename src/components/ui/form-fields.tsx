import { useState, useRef, useEffect, useMemo } from "react";
import LinkSearchField from "./LinkSearchField";
import type { LazyOptionsState } from "@/services/lookup-cache";

export const inputClass =
  "w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 disabled:bg-gray-50 disabled:text-muted disabled:cursor-not-allowed disabled:opacity-100";

export const labelClass =
  "block text-xs font-semibold text-muted mb-1.5";

export const errCls = (error?: string) =>
  error
    ? "border-danger-500 focus:ring-danger-500/20 focus:border-danger-500"
    : "";

export function LinkField({
  doctype: _doctype,
  value,
  onChange,
  searchFn,
  placeholder = "Select…",
  readOnly = false,
  validateValue,
}: {
  doctype: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  searchFn: (query: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>;
  placeholder?: string;
  readOnly?: boolean;
  validateValue?: (value: string) => Promise<void>;
}) {
  return (
    <LinkSearchField
      value={value ?? ""}
      onChange={onChange}
      searchFn={searchFn}
      validate={validateValue ?? (async () => {})}
      placeholder={placeholder}
      readOnly={readOnly}
    />
  );
}

export function Combobox({
  name,
  value,
  options,
  placeholder = "Select…",
  onChange,
  loading = false,
  error,
  load,
  disabled = false,
}: {
  name: string;
  value: string | undefined;
  options: string[] | LazyOptionsState<string[]>;
  placeholder?: string;
  onChange: (name: string, value: string) => void;
  loading?: boolean;
  error?: string;
  load?: () => void;
  disabled?: boolean;
}) {
  const list = Array.isArray(options) ? options : options.value;
  const ensure = Array.isArray(options) ? undefined : options.ensure;
  const busy = loading || (!Array.isArray(options) && options.loading);
  const [query, setQuery] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => o.toLowerCase().includes(q));
  }, [query, list]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const commit = (val: string) => {
    setQuery(val);
    setOpen(false);
    onChange(name, val);
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={query}
        placeholder={busy ? "Loading…" : placeholder}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlightIndex(0);
        }}
        onFocus={() => {
          setOpen(true);
          setHighlightIndex(0);
          load?.();
          ensure?.();
        }}
        onBlur={() => commit(query)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            if (open && filtered.length > 0 && highlightIndex >= 0) {
              e.preventDefault();
              commit(filtered[highlightIndex]);
            } else {
              commit(query);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`${inputClass} ${errCls(error)}`}
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-white shadow-lg">
          {busy ? (
            <div className="px-3 py-2.5 text-sm text-muted">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-muted">No results</div>
          ) : (
            filtered.map((opt, i) => (
              <button
                key={opt}
                type="button"
                onMouseEnter={() => setHighlightIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(opt);
                }}
                className={`block w-full text-left px-3 py-2 text-sm ${
                  i === highlightIndex
                    ? "bg-primary-500/10 text-primary-600"
                    : "text-body hover:bg-muted/50"
                }`}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
      {error && <p className="text-xs text-danger-500 mt-1">{error}</p>}
    </div>
  );
}
