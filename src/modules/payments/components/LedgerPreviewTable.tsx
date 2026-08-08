"use client"

import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  computeColumnAlign,
  filterLedgerRows,
  formatLedgerCell,
  sortLedgerRows,
  type NormalizedColumn,
  type SortState,
} from "./ledgerUtils"

const SERIAL_WIDTH = 30
const FILTER_DEBOUNCE = 300

type Align = "left" | "center" | "right"

interface LedgerPreviewTableProps {
  columns: NormalizedColumn[]
  rows: unknown[][]
  defaultCurrency?: string
  className?: string
}

interface MenuState {
  colKey: string
  x: number
  y: number
  sticky: boolean
}

const SERIAL_STYLE: CSSProperties = { position: "sticky", left: 0, zIndex: 2 }

export default function LedgerPreviewTable({
  columns,
  rows,
  defaultCurrency,
  className,
}: LedgerPreviewTableProps) {
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(() => new Set())
  const [stickyKeys, setStickyKeys] = useState<Set<string>>(() => new Set())
  const [sort, setSort] = useState<{ colKey: string | null; sortOrder: "none" | "asc" | "desc" }>({
    colKey: null,
    sortOrder: "none",
  })
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>({})
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({})
  const [menu, setMenu] = useState<MenuState | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setAppliedFilters(filterDraft), FILTER_DEBOUNCE)
    return () => clearTimeout(t)
  }, [filterDraft])

  const cols = useMemo(() => columns.filter((c) => !removedKeys.has(c.key)), [columns, removedKeys])

  const colIndexByKey = useMemo(() => {
    const map: Record<string, number> = {}
    columns.forEach((c, i) => {
      map[c.key] = i
    })
    return map
  }, [columns])

  const aligns = useMemo(() => {
    const arr = computeColumnAlign(columns, rows)
    const byKey: Record<string, Align> = {}
    columns.forEach((c, i) => {
      byKey[c.key] = arr[i] ?? "left"
    })
    return byKey
  }, [columns, rows])

  const sortedRows = useMemo(() => {
    if (sort.sortOrder === "none" || !sort.colKey) return rows
    const idx = colIndexByKey[sort.colKey]
    if (idx === undefined) return rows
    const state: SortState = { colIndex: idx, sortOrder: sort.sortOrder }
    return sortLedgerRows(columns, rows, state).rows
  }, [columns, rows, sort, colIndexByKey])

  const formatOpts = useMemo(() => ({ currency: defaultCurrency }), [defaultCurrency])

  const visibleRows = useMemo(() => {
    const filtered = filterLedgerRows(columns, sortedRows, appliedFilters, formatOpts)
    return filtered.map((row) => ({
      row,
      serial: sortedRows.indexOf(row) + 1,
    }))
  }, [columns, sortedRows, appliedFilters, formatOpts])

  const stickyOffsets = useMemo(() => {
    const offsets: Record<string, number> = {}
    let running = SERIAL_WIDTH
    cols.forEach((col) => {
      if (stickyKeys.has(col.key)) {
        offsets[col.key] = running
        running += col.width ?? 110
      }
    })
    return offsets
  }, [cols, stickyKeys])

  const lastStickyKey = useMemo(() => {
    let last = ""
    let max = 0
    for (const [key, off] of Object.entries(stickyOffsets)) {
      if (off > max) {
        max = off
        last = key
      }
    }
    return last
  }, [stickyOffsets])

  const stickyStyle = (key: string): CSSProperties | undefined => {
    const off = stickyOffsets[key]
    if (off === undefined) return undefined
    return { position: "sticky", left: off, zIndex: 2 }
  }

  const onFilterChange = (key: string, value: string) => {
    setFilterDraft((prev) => {
      const next = { ...prev }
      if (value) {
        next[key] = value
      } else {
        delete next[key]
      }
      return next
    })
  }

  const openMenu = (e: MouseEvent<HTMLButtonElement>, colKey: string, sticky: boolean) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ colKey, x: rect.left, y: rect.bottom + 4, sticky })
  }

  const runMenuAction = (action: string) => {
    if (!menu) return
    const key = menu.colKey
    if (action === "Sort Ascending") {
      setSort({ colKey: key, sortOrder: "asc" })
    } else if (action === "Sort Descending") {
      setSort({ colKey: key, sortOrder: "desc" })
    } else if (action === "Reset sorting") {
      setSort({ colKey: null, sortOrder: "none" })
    } else if (action === "Remove column") {
      setRemovedKeys((prev) => {
        const next = new Set(prev)
        next.add(key)
        return next
      })
      setFilterDraft((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setAppliedFilters((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      if (sort.colKey === key) setSort({ colKey: null, sortOrder: "none" })
    } else if (action === "Freeze") {
      setStickyKeys((prev) => new Set(prev).add(key))
    } else if (action === "Unfreeze") {
      setStickyKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
    setMenu(null)
  }

  const formatCell = (col: NormalizedColumn, value: unknown): string =>
    formatLedgerCell(col, value, formatOpts)

  return (
    <div className={cn("ledger-preview-datatable", className)}>
      <div className="dt-scrollable">
        <div className="dt-header">
          <div className="dt-row dt-row-header">
            <div
              className={cn(
                "dt-cell dt-cell--header dt-cell-serial dt-cell--sticky",
                lastStickyKey === "" && "dt-cell--sticky-last"
              )}
              style={SERIAL_STYLE}
            >
              <div className="dt-cell__content dt-cell__content--header-0"></div>
            </div>
            {cols.map((col) => {
              const isSorted = sort.colKey === col.key && sort.sortOrder !== "none"
              const sticky = stickyStyle(col.key)
              return (
                <div
                  key={col.key}
                  className={cn(
                    "dt-cell dt-cell--header",
                    sticky && "dt-cell--sticky",
                    lastStickyKey === col.key && "dt-cell--sticky-last"
                  )}
                  style={sticky}
                  title={col.label}
                >
                  <div className={cn("dt-cell__content", `dt-cell__content--header-${colIndexByKey[col.key] + 1}`)}>
                    <span>{col.label}</span>
                    {isSorted && (
                      <span className="sort-indicator" data-testid={`sort-indicator-${col.key}`}>
                        {sort.sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                    <button
                      type="button"
                      className="dt-dropdown__toggle"
                      onClick={(e) => openMenu(e, col.key, stickyKeys.has(col.key))}
                      aria-haspopup="menu"
                      aria-label={`Options for ${col.label}`}
                      data-testid={`ledger-header-menu-${col.key}`}
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="dt-row dt-row-filter">
            <div className="dt-cell dt-cell--filter dt-cell-serial" style={SERIAL_STYLE}>
              <input className="dt-filter dt-input" type="text" disabled tabIndex={1} data-testid="ledger-filter-serial" />
            </div>
            {cols.map((col) => {
              const sticky = stickyStyle(col.key)
              return (
                <div
                  key={col.key}
                  className={cn("dt-cell dt-cell--filter", sticky && "dt-cell--sticky")}
                  style={sticky}
                >
                  <input
                    className="dt-filter dt-input"
                    type="text"
                    tabIndex={1}
                    title={`Filter based on ${col.label}`}
                    value={filterDraft[col.key] ?? ""}
                    onChange={(e) => onFilterChange(col.key, e.target.value)}
                    data-testid={`ledger-filter-${col.key}`}
                  />
                </div>
              )
            })}
          </div>
        </div>
        {visibleRows.length === 0 && (
          <div className="dt-scrollable__no-data">
            <span className="no-data-message">No Data</span>
          </div>
        )}
        {visibleRows.map(({ row, serial }) => (
          <div key={serial} className="dt-row" data-testid={`ledger-row-${serial}`}>
            <div
              className={cn(
                "dt-cell dt-cell--col-0 dt-cell-serial dt-cell--sticky",
                lastStickyKey === "" && "dt-cell--sticky-last"
              )}
              style={SERIAL_STYLE}
            >
              <div className="dt-cell__content dt-cell__content--col-0 centered" title={String(serial)}>
                {serial}
              </div>
            </div>
            {cols.map((col) => {
              const sticky = stickyStyle(col.key)
              const idx = colIndexByKey[col.key]
              const align = aligns[col.key] ?? "left"
              const value = row[idx]
              return (
                <div
                  key={col.key}
                  className={cn(
                    "dt-cell",
                    sticky && "dt-cell--sticky",
                    lastStickyKey === col.key && "dt-cell--sticky-last"
                  )}
                  style={sticky}
                >
                  <div
                    className={cn(
                      "dt-cell__content",
                      `dt-cell__content--col-${idx + 1}`,
                      align === "right" && "right-aligned",
                      align === "center" && "centered"
                    )}
                    title={formatCell(col, value)}
                  >
                    {formatCell(col, value)}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {menu && (
        <>
          <div className="dt-dropdown-backdrop" onClick={() => setMenu(null)} />
          <div className="dt-dropdown__list" data-testid="ledger-menu" style={{ left: menu.x, top: menu.y }}>
            {["Sort Ascending", "Sort Descending"].map((item) => (
              <div
                key={item}
                className="dt-dropdown__list-item"
                onClick={() => runMenuAction(item)}
                data-testid={`ledger-menu-${item.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item}
              </div>
            ))}
            <div className="dt-dropdown__list-item" onClick={() => runMenuAction("Reset sorting")}>
              Reset sorting
            </div>
            <div className="dt-dropdown__list-item" onClick={() => runMenuAction("Remove column")}>
              Remove column
            </div>
            {!menu.sticky ? (
              <div className="dt-dropdown__list-item" onClick={() => runMenuAction("Freeze")}>
                Freeze
              </div>
            ) : (
              <div className="dt-dropdown__list-item" onClick={() => runMenuAction("Unfreeze")}>
                Unfreeze
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
