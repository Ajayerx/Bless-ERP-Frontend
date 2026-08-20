import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Search, X, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

type SearchResult = { value: string; label: string; description: string }

interface LinkSearchFieldProps {
  value?: string
  onChange?: (value: string | undefined) => void
  searchFn: (query: string) => Promise<{ items: SearchResult[] }>
  validate?: (value: string) => Promise<void>
  onCreateNew?: () => void
  onAdvancedSearch?: () => void
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  label?: string
  required?: boolean
  className?: string
  inputClassName?: string
  docType?: string
  clearIconMode?: "always" | "hover"
  suppressExternalLabelFetch?: boolean
  /** Eagerly resolve a label for a pre-filled value on mount. Off by default
   * so link inputs don't fire a search_link request just to display a value;
   * labels resolve on focus/typing. */
  fetchLabelOnMount?: boolean
  displayLabel?: string
  onMouseDownCapture?: (e: React.MouseEvent) => void
}

export default function LinkSearchField({
  value,
  onChange,
  searchFn,
  validate,
  onCreateNew,
  onAdvancedSearch,
  placeholder,
  disabled = false,
  readOnly = false,
  label,
  required = false,
  className,
  inputClassName,
  clearIconMode = "always",
  suppressExternalLabelFetch = false,
  fetchLabelOnMount = false,
  displayLabel,
  onMouseDownCapture,
}: LinkSearchFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value ?? "")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [selectedLabel, setSelectedLabel] = useState(value ?? "")
  const [validationError, setValidationError] = useState("")
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [ddPos, setDdPos] = useState<{
    left: number
    width: number
    top?: number
    bottom?: number
    maxHeight: number
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchFnRef = useRef(searchFn)
  const fetchedRef = useRef(false)
  const lastValidatedRef = useRef<{ value: string; label: string } | null>(null)
  const lastValueRef = useRef(value)
  const labelFetchValueRef = useRef<string | null>(null)
  const queryRef = useRef("")
  const cacheRef = useRef(new Map<string, SearchResult[]>())
  searchFnRef.current = searchFn
  queryRef.current = query

  // ERPNext ControlLink parity (frappe link.js): keep a per-field cache of
  // search results keyed by term so repeat opens/typing render instantly,
  // then refresh in the background. Stale responses are dropped.
  const showResults = useCallback((items: SearchResult[]) => {
    setResults(items)
    setHighlightedIndex((prev) => {
      const max = items.length - 1
      if (max < 0) return -1
      return prev === -1 ? 0 : Math.min(prev, max)
    })
  }, [])

  const applyValueLabel = (items: SearchResult[]) => {
    if (!value || (selectedLabel && selectedLabel !== value) || !fetchedRef.current) return
    const match = items.find((item) => item.value === value)
    if (match) {
      setSelectedLabel(match.label || match.value)
      setQuery(match.label || match.value)
    }
  }

  const cachePut = (term: string, items: SearchResult[]) => {
    cacheRef.current.set(term, items)
    if (cacheRef.current.size > 50) {
      const firstKey = cacheRef.current.keys().next().value
      if (firstKey !== undefined) cacheRef.current.delete(firstKey)
    }
  }

  const doSearch = useCallback(async (q: string) => {
    const cached = cacheRef.current.get(q)
    if (cached) {
      showResults(cached)
      applyValueLabel(cached)
    }
    setLoading(true)
    try {
      const res = await searchFnRef.current(q)
      if (queryRef.current !== q) return
      cachePut(q, res.items)
      showResults(res.items)
      applyValueLabel(res.items)
    } catch {
      if (queryRef.current !== q) return
      showResults([])
    } finally {
      if (queryRef.current === q) setLoading(false)
    }
  }, [value, selectedLabel])

  const positionDropdown = useCallback(() => {
    const anchor = wrapperRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const width = Math.min(Math.round(rect.width), window.innerWidth - 16)
    const spaceAbove = rect.top
    const spaceBelow = window.innerHeight - rect.bottom
    const above = spaceBelow < 100 && spaceAbove > spaceBelow
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    setDdPos(
      above
        ? { left, width, bottom: Math.max(8, window.innerHeight - rect.top + 4), maxHeight: Math.max(60, spaceAbove - 8) }
        : { left, width, top: rect.bottom + 4, maxHeight: Math.max(60, spaceBelow - 8) }
    )
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const inWrapper = wrapperRef.current?.contains(target)
      const inDropdown = dropdownRef.current?.contains(target)
      if (!inWrapper && !inDropdown) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open || readOnly) {
      setDdPos(null)
      return
    }
    positionDropdown()
    window.addEventListener("scroll", positionDropdown, true)
    window.addEventListener("resize", positionDropdown)
    return () => {
      window.removeEventListener("scroll", positionDropdown, true)
      window.removeEventListener("resize", positionDropdown)
    }
  }, [open, readOnly, positionDropdown])

  useEffect(() => {
    if (value === lastValueRef.current) return
    lastValueRef.current = value
    if (!value) {
      setQuery("")
      setSelectedLabel("")
      setValidationError("")
      lastValidatedRef.current = null
      return
    }
    const last = lastValidatedRef.current
    if (last?.value === value) {
      setQuery(last.label)
      setSelectedLabel(last.label)
    } else {
      const label = displayLabel || value
      setQuery(label)
      setSelectedLabel(label)
      lastValidatedRef.current = { value, label }
    }
  }, [value, displayLabel])

  useEffect(() => {
    if (suppressExternalLabelFetch || !fetchLabelOnMount) return
    if (value && labelFetchValueRef.current !== value && selectedLabel === value) {
      labelFetchValueRef.current = value
      fetchedRef.current = true
      doSearch("")
    }
  }, [value, selectedLabel, doSearch, suppressExternalLabelFetch, fetchLabelOnMount])

  const handleSelect = (item: SearchResult) => {
    onChange?.(item.value)
    setQuery(item.label || item.value)
    setSelectedLabel(item.label || item.value)
    setResults([])
    setOpen(false)
    setHighlightedIndex(-1)
    labelFetchValueRef.current = item.value
    if (validate) {
      validate(item.value)
        .then(() => {
          lastValidatedRef.current = { value: item.value, label: item.label || item.value }
          setValidationError("")
        })
        .catch((err) => {
          lastValidatedRef.current = null
          setValidationError(err instanceof Error ? err.message : "Invalid link")
          onChange?.(undefined)
          setQuery("")
          setSelectedLabel("")
        })
    } else {
      lastValidatedRef.current = { value: item.value, label: item.label || item.value }
    }
  }

  const handleClear = () => {
    onChange?.(undefined)
    setQuery("")
    setSelectedLabel("")
    setResults([])
    setHighlightedIndex(-1)
    setValidationError("")
    lastValidatedRef.current = null
    fetchedRef.current = false
    labelFetchValueRef.current = null
    inputRef.current?.focus()
  }

  const handleBlur = () => {
    setFocused(false)
    if (readOnly) return
    if (!validate) return
    if (blurRef.current) clearTimeout(blurRef.current)
    blurRef.current = setTimeout(() => {
      const text = queryRef.current.trim()
      const last = lastValidatedRef.current
      if (!text) return
      if (last && (text === last.label || text === last.value)) return
      validate(text)
        .then(() => {
          lastValidatedRef.current = { value: text, label: text }
          setValidationError("")
          onChange?.(text)
        })
        .catch((err) => {
          lastValidatedRef.current = null
          setValidationError(err instanceof Error ? err.message : "Invalid link")
          if (last) {
            setQuery(last.label)
            setSelectedLabel(last.label)
            onChange?.(last.value)
          } else {
            setQuery("")
            setSelectedLabel("")
            onChange?.(undefined)
          }
        })
    }, 150)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (!open) setOpen(true)
    setHighlightedIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const cached = cacheRef.current.get(val)
    if (cached) showResults(cached)
    if (!val.trim()) {
      if (fetchedRef.current) doSearch("")
    } else {
      debounceRef.current = setTimeout(() => doSearch(val), 500)
    }
  }

  const handleFocus = () => {
    if (readOnly) return
    setFocused(true)
    // Open the dropdown on every tap (filled or empty) so options are always
    // one tap away. Cache makes repeat opens instant; typing filters further.
    if (!fetchedRef.current) fetchedRef.current = true
    setOpen(true)
    doSearch(queryRef.current.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    const totalItems = results.length + (onCreateNew ? 1 : 0) + (onAdvancedSearch ? 1 : 0)
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % totalItems)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        handleSelect(results[highlightedIndex])
      } else if (onCreateNew && highlightedIndex === results.length) {
        onCreateNew()
        setOpen(false)
      } else if (onAdvancedSearch && highlightedIndex === results.length + (onCreateNew ? 1 : 0)) {
        onAdvancedSearch()
        setOpen(false)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const showDropdown = open && !readOnly
  const revealClear = clearIconMode === "hover" ? hovered || focused : true
  const showClear = !!value && !disabled && !readOnly && revealClear
  const reserveClearSpace =
    clearIconMode === "hover" && !!value && !disabled && !readOnly

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-xs font-semibold text-muted mb-1.5">
          {label}
          {required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      <div ref={wrapperRef} className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onMouseDownCapture={onMouseDownCapture}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            className={cn(
              "w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-body placeholder:text-muted transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
              showClear || reserveClearSpace ? "pr-9" : "pr-3",
              (disabled || readOnly) ? "bg-gray-50 cursor-not-allowed opacity-70" : "",
              inputClassName,
            )}
          />
          {showClear && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className="absolute right-2 p-1 text-muted hover:text-heading transition-colors"
              tabIndex={-1}
              aria-label="Clear"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {validationError && (
          <p className="mt-1 text-xs text-danger-600">{validationError}</p>
        )}

        {showDropdown && ddPos && createPortal(
          <div
            ref={dropdownRef}
            className="z-[1000] bg-surface border border-border rounded-xl shadow-lg overflow-hidden overflow-y-auto"
            style={{
              position: "fixed",
              left: ddPos.left,
              width: ddPos.width,
              maxHeight: ddPos.maxHeight,
              ...(ddPos.top !== undefined ? { top: ddPos.top } : { bottom: ddPos.bottom }),
            }}
          >
            {loading && results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted">Searching...</div>
            ) : results.length > 0 ? (
              <>
                <div className="divide-y divide-border/50">
                  {results.map((item, idx) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 transition-colors text-sm",
                        idx === highlightedIndex
                          ? "bg-primary-50"
                          : "hover:bg-gray-50"
                      )}
                    >
                      <div
                        className="font-semibold text-heading"
                        dangerouslySetInnerHTML={{ __html: item.label || item.value }}
                      />
                      {item.value && (
                        <div className="text-xs text-muted mt-0.5 truncate">
                          {item.value}
                          {item.description ? (
                            <span dangerouslySetInnerHTML={{ __html: `, ${item.description}` }} />
                          ) : null}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-border divide-y divide-border/50">
                  {onCreateNew && (
                    <button
                      type="button"
                      onClick={() => { onCreateNew(); setOpen(false) }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm text-primary-600 hover:bg-primary-50/50 flex items-center gap-2 transition-colors",
                        highlightedIndex === results.length && "bg-primary-50"
                      )}
                    >
                      <Plus size={14} />
                      Create New
                    </button>
                  )}
                  {onAdvancedSearch && (
                    <button
                      type="button"
                      onClick={() => { onAdvancedSearch(); setOpen(false) }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm text-muted hover:bg-gray-50 flex items-center gap-2 transition-colors",
                        highlightedIndex === results.length + (onCreateNew ? 1 : 0) && "bg-gray-100"
                      )}
                    >
                      <Search size={14} />
                      Advanced Search
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="px-4 py-3">
                <p className="text-sm text-muted">No results found</p>
                {onCreateNew && (
                  <button
                    type="button"
                    onClick={() => { onCreateNew(); setOpen(false) }}
                    className="mt-2 text-sm text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Create New
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}
