"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Link } from "react-router-dom"
import { Loader2, ArrowRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import { Button } from "@/components/ui"
import LinkSearchField from "@/components/ui/LinkSearchField"
import { invoiceService, customerService } from "@/services"
import { cn } from "@/lib/utils"

interface SourceDoc {
  name: string
  [key: string]: unknown
}

interface ChildRow {
  name: string
  parent?: string
  [key: string]: unknown
}

interface SetterField {
  fieldname: string
  label: string
  defaultValue?: string
}

interface DataField {
  fieldname: string
  label: string
}

interface GetItemsFromModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceDoctype: string
  method: string
  title: string
  setters?: SetterField[]
  childDoctype?: string
  childFieldname?: string
  childColumns?: string[]
  dataFields?: DataField[]
  customer?: string
  company?: string
  formData?: Record<string, unknown>
  searchQuery?: string
  docLinkBase?: string
  makeDocLabel?: string
  onItemsFetched: (items: Array<Record<string, unknown>>) => void
  onMakeDoc?: (setterValues: Record<string, string>) => void
}

const SETTER_LABELS: Record<string, string> = {
  customer: "Customer",
  party_name: "Customer",
}

function unscrub(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export default function GetItemsFromModal({
  open,
  onOpenChange,
  sourceDoctype,
  method,
  title,
  setters = [],
  childDoctype,
  childFieldname,
  childColumns = [],
  dataFields = [],
  customer,
  company,
  formData,
  searchQuery,
  docLinkBase,
  makeDocLabel,
  onItemsFetched,
  onMakeDoc,
}: GetItemsFromModalProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [results, setResults] = useState<SourceDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [pageLength, setPageLength] = useState(20)
  const [more, setMore] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Record<string, SourceDoc>>({})
  const [setterValues, setSetterValues] = useState<Record<string, string>>({})
  const [showChild, setShowChild] = useState(false)
  const [childResults, setChildResults] = useState<ChildRow[]>([])
  const [childLoading, setChildLoading] = useState(false)
  const [childMore, setChildMore] = useState(false)
  const [childPageLength, setChildPageLength] = useState(20)
  const [selectedChildren, setSelectedChildren] = useState<Set<string>>(new Set())
  const [dataValues, setDataValues] = useState<Record<string, boolean>>({})
  const [fetching, setFetching] = useState(false)

  const userTypedRef = useRef(false)
  const prevSetterValuesRef = useRef<Record<string, string>>({})
  const skipSetterSearchRef = useRef(false)
  const selectedItemsRef = useRef<Record<string, SourceDoc>>({})

  useEffect(() => {
    selectedItemsRef.current = selectedItems
  }, [selectedItems])

  const setterFieldnames = useMemo(() => setters.map((s) => s.fieldname), [setters])
  const resultColumns = ["name", ...setterFieldnames]
  const parentGridTemplate = `2fr repeat(${Math.max(0, setterFieldnames.length)}, minmax(0, 1fr))`
  const childGridTemplate = `1.5fr repeat(${Math.max(0, childColumns.length)}, minmax(0, 1fr))`

  const buildFilters = useCallback(
    (values: Record<string, string>) => {
      const filters: Record<string, unknown> = {}
      if (company) filters["company"] = company
      if (sourceDoctype === "Sales Order") {
        filters["docstatus"] = 1
        filters["status"] = ["not in", ["Closed", "On Hold"]]
        filters["per_billed"] = ["<", 99.99]
      }
      if (sourceDoctype === "Quotation") {
        filters["docstatus"] = 1
        filters["status"] = ["!=", "Lost"]
      }
      if (sourceDoctype === "Delivery Note") {
        filters["docstatus"] = 1
        filters["is_return"] = formData?.isReturn ? 1 : 0
        if (customer) filters["customer"] = customer
      }
      for (const fieldname of setterFieldnames) {
        if (values[fieldname]) filters[fieldname] = values[fieldname]
      }
      return filters
    },
    [company, sourceDoctype, customer, formData, setterFieldnames],
  )

  const runSearch = useCallback(
    async (term: string, values: Record<string, string>, pl: number) => {
      setLoading(true)
      setError("")
      try {
        const rows = await invoiceService.searchWidget({
          doctype: sourceDoctype,
          txt: term,
          filters: buildFilters(values),
          filter_fields: setterFieldnames.length ? setterFieldnames : undefined,
          query: searchQuery || undefined,
          page_length: pl + 5,
          as_dict: true,
        })
        const list = Array.isArray(rows) ? rows : []
        setMore(list.length > pl)
        const freshRows = list.slice(0, pl) as SourceDoc[]
        setResults(() => {
          const checkedRows = Object.values(selectedItemsRef.current)
          const checkedNames = new Set(checkedRows.map((r) => String(r.name)))
          return [...checkedRows, ...freshRows.filter((r) => !checkedNames.has(String(r.name)))]
        })
      } catch (e) {
        setResults(Object.values(selectedItemsRef.current))
        setMore(false)
        setError(e instanceof Error ? e.message : "Search failed.")
      } finally {
        setLoading(false)
      }
    },
    [sourceDoctype, buildFilters, setterFieldnames, searchQuery],
  )

  useEffect(() => {
    if (!open) return
    const init: Record<string, string> = {}
    for (const s of setters) init[s.fieldname] = s.defaultValue ?? ""
    prevSetterValuesRef.current = { ...init }
    skipSetterSearchRef.current = true
    userTypedRef.current = false
    setSearchTerm("")
    setSetterValues(init)
    setResults([])
    setSelectedDocs(new Set())
    setSelectedItems({})
    setSelectedChildren(new Set())
    setChildResults([])
    setShowChild(false)
    setChildPageLength(20)
    setPageLength(20)
    const dataInit: Record<string, boolean> = {}
    for (const d of dataFields) dataInit[d.fieldname] = false
    setDataValues(dataInit)
    setError("")
    runSearch("", init, 20)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!userTypedRef.current) return
    const timeout = setTimeout(() => {
      if (showChild) {
        fetchChildRows(childPageLength, searchTerm, setterValues)
      } else {
        runSearch(searchTerm, setterValues, pageLength)
      }
    }, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, open, showChild])

  useEffect(() => {
    if (!open) return
    if (skipSetterSearchRef.current) {
      skipSetterSearchRef.current = false
      return
    }
    if (JSON.stringify(prevSetterValuesRef.current) === JSON.stringify(setterValues)) return
    prevSetterValuesRef.current = { ...setterValues }
    if (showChild) {
      fetchChildRows(childPageLength, searchTerm, setterValues)
    } else {
      runSearch(searchTerm, setterValues, pageLength)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setterValues, open])

  const handleMore = () => {
    const pl = pageLength + 20
    setPageLength(pl)
    runSearch(searchTerm, setterValues, pl)
  }

  const toggleDoc = (name: string, row: SourceDoc) => {
    const next = new Set(selectedDocs)
    const nextItems = { ...selectedItems }
    if (next.has(name)) {
      next.delete(name)
      delete nextItems[name]
    } else {
      next.add(name)
      nextItems[name] = row
    }
    setSelectedDocs(next)
    setSelectedItems(nextItems)
  }

  const searchCustomer = useCallback(
    async (q: string) => {
      const items = await customerService.searchLink("Customer", q, "Sales Invoice", undefined, undefined, true)
      return { items }
    },
    [],
  )

  const fetchChildRows = useCallback(
    async (pl: number, term: string, values: Record<string, string>) => {
      if (!childDoctype || !childFieldname) return
      setChildLoading(true)
      try {
        const parentRows = await invoiceService.searchWidget({
          doctype: sourceDoctype,
          txt: term,
          filters: buildFilters(values),
          filter_fields: ["name"],
          query: searchQuery || undefined,
          page_length: pl + 5,
          as_dict: true,
        })
        const parentNames = (Array.isArray(parentRows) ? parentRows : []).map((r) => String(r.name))
        const filters: unknown[] = [["parentfield", "=", childFieldname]]
        if (parentNames.length) {
          filters.push(["parent", "in", parentNames])
        }
        const rows = await invoiceService.getList({
          doctype: childDoctype,
          fields: ["name", "parent", ...childColumns],
          filters,
          parent: sourceDoctype,
          order_by: "parent",
          limit_page_length: pl + 5,
        })
        const list = Array.isArray(rows) ? rows : []
        setChildMore(list.length > pl)
        setChildResults(list.slice(0, pl) as ChildRow[])
      } catch {
        setChildResults([])
        setChildMore(false)
      } finally {
        setChildLoading(false)
      }
    },
    [childDoctype, childFieldname, childColumns, sourceDoctype, searchQuery, buildFilters],
  )

  const handleChildMore = () => {
    const pl = childPageLength + 20
    setChildPageLength(pl)
    fetchChildRows(pl, searchTerm, setterValues)
  }

  const toggleChildItem = (name: string) => {
    const next = new Set(selectedChildren)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    setSelectedChildren(next)
  }

  const handleGetItems = async () => {
    const parentsOfSelected = Array.from(selectedChildren)
      .map((name) => childResults.find((r) => r.name === name)?.parent)
      .filter((p): p is string => !!p)
    const sourceNames = Array.from(new Set([...selectedDocs, ...parentsOfSelected]))
    if (sourceNames.length === 0) {
      setError(`Please select at least one ${sourceDoctype}.`)
      return
    }
    setFetching(true)
    try {
      const args: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(setterValues)) {
        if (v) args[k] = v
      }
      for (const [k, v] of Object.entries(dataValues)) {
        args[k] = v ? 1 : 0
      }
      args["filtered_children"] = Array.from(selectedChildren)
      const targetDoc = { customer, company, ...(formData ? { ...formData } : {}) }
      const result = await invoiceService.mapSourceDocuments(method, sourceNames, targetDoc, args)
      const items = (result as Record<string, unknown>)[childFieldname ?? "items"] as Array<Record<string, unknown>> | undefined
      if (items) {
        onItemsFetched(items.map((item) => ({ ...item, id: crypto.randomUUID() })))
        onOpenChange(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch items.")
    } finally {
      setFetching(false)
    }
  }

  const renderParentRow = (doc: SourceDoc) => (
    <label
      key={doc.name}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors",
        selectedDocs.has(doc.name) && "bg-primary-50",
      )}
    >
      <input
        type="checkbox"
        checked={selectedDocs.has(doc.name)}
        onChange={() => toggleDoc(doc.name, doc)}
        className="h-4 w-4 rounded border-border"
      />
      <div className="flex-1 grid gap-4 text-sm" style={{ gridTemplateColumns: parentGridTemplate }}>
        {docLinkBase ? (
          <Link
            to={`${docLinkBase}/${encodeURIComponent(String(doc.name))}`}
            onClick={(e) => e.stopPropagation()}
            className="text-body font-medium truncate hover:text-primary-600"
          >
            {doc.name}
          </Link>
        ) : (
          <span className="text-body font-medium truncate">{doc.name}</span>
        )}
        {setterFieldnames.map((fieldname) => (
          <span key={fieldname} className="text-muted truncate">
            {String((doc as Record<string, unknown>)[fieldname] ?? "")}
          </span>
        ))}
      </div>
    </label>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Primary filters row: search + child toggle (col 1), setters (col 2-3) */}
          <div className="grid grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted mb-1.5">Name</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  userTypedRef.current = true
                  setSearchTerm(e.target.value)
                }}
                className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
              {childFieldname && childDoctype && (
                <label className="flex items-center gap-2 text-sm text-body cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={showChild}
                    onChange={(e) => {
                      const next = e.target.checked
                      setShowChild(next)
                      if (next) {
                        setSelectedDocs(new Set())
                        setSelectedItems({})
                        setResults([])
                        fetchChildRows(childPageLength, searchTerm, setterValues)
                      } else {
                        setChildResults([])
                        setSelectedChildren(new Set())
                        runSearch(searchTerm, setterValues, pageLength)
                      }
                    }}
                    className="h-4 w-4 rounded border-border"
                  />
                  Select {childDoctype}
                </label>
              )}
            </div>
            <div className="space-y-2">
              {setters.map((s) => (
                <LinkSearchField
                  key={s.fieldname}
                  value={setterValues[s.fieldname]}
                  onChange={(v) =>
                    setSetterValues((prev) => ({ ...prev, [s.fieldname]: v ?? "" }))
                  }
                  searchFn={searchCustomer}
                  label={s.label || SETTER_LABELS[s.fieldname] || unscrub(s.fieldname)}
                  placeholder={`Select ${s.label || SETTER_LABELS[s.fieldname] || unscrub(s.fieldname)}...`}
                  docType="Customer"
                />
              ))}
            </div>
          </div>

          {/* Data fields (e.g. merge taxes) */}
          {dataFields.length > 0 && (
            <div className="space-y-2">
              {dataFields.map((d) => (
                <label key={d.fieldname} className="flex items-center gap-2 text-sm text-body cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!dataValues[d.fieldname]}
                    onChange={(e) =>
                      setDataValues((prev) => ({ ...prev, [d.fieldname]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  {d.label}
                </label>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-danger-600">{error}</p>}

          {/* Parent results (hidden when child selection is active) */}
          {!showChild && (
            <div>
              <div
                className="grid gap-4 px-4 py-2 text-xs font-semibold text-muted border border-b-0 border-border rounded-t-lg"
                style={{ gridTemplateColumns: parentGridTemplate }}
              >
                {resultColumns.map((col) => (
                  <span key={col} className="truncate">
                    {col === "name" ? "Name" : SETTER_LABELS[col] || unscrub(col)}
                  </span>
                ))}
              </div>
              <div className="border border-border rounded-b-lg max-h-48 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-sm text-muted">Searching...</div>
                ) : results.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted">No {sourceDoctype} found.</div>
                ) : (
                  results.map((doc) => renderParentRow(doc))
                )}
              </div>
              {more && !loading && (
                <button
                  type="button"
                  onClick={handleMore}
                  className="mt-1.5 text-xs font-semibold text-primary-600 hover:underline"
                >
                  More
                </button>
              )}
            </div>
          )}

          {/* Child items */}
          {childFieldname && childDoctype && showChild && (
            <div>
              <div
                className="grid gap-4 px-4 py-2 text-xs font-semibold text-muted border border-b-0 border-border rounded-t-lg"
                style={{ gridTemplateColumns: childGridTemplate }}
              >
                <span className="truncate">{sourceDoctype}</span>
                {childColumns.map((c) => (
                  <span key={c} className="truncate">
                    {unscrub(c)}
                  </span>
                ))}
              </div>
              <div className="border border-border rounded-b-lg max-h-56 overflow-y-auto">
                {childLoading ? (
                  <div className="p-4 text-center text-sm text-muted">Loading items...</div>
                ) : childResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted">No Data</div>
                ) : (
                  childResults.map((item) => (
                    <label
                      key={item.name}
                      className="flex items-center gap-3 px-4 py-2 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedChildren.has(item.name)}
                        onChange={() => toggleChildItem(item.name)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <div
                        className="flex-1 grid gap-4 text-sm"
                        style={{ gridTemplateColumns: childGridTemplate }}
                      >
                        <span className="text-muted truncate">{String(item.parent ?? "")}</span>
                        {childColumns.map((c) => (
                          <span key={c} className="text-body tabular-nums truncate">
                            {String(item[c] ?? "")}
                          </span>
                        ))}
                      </div>
                    </label>
                  ))
                )}
              </div>
              {childMore && !childLoading && (
                <button
                  type="button"
                  onClick={handleChildMore}
                  className="mt-1.5 text-xs font-semibold text-primary-600 hover:underline"
                >
                  More
                </button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={fetching}>
            Close
          </Button>
          {makeDocLabel && (
            <Button
              variant="outline"
              onClick={() => {
                if (onMakeDoc) onMakeDoc(setterValues)
                else onOpenChange(false)
              }}
              disabled={fetching}
              className="flex items-center gap-1.5"
            >
              Make {makeDocLabel}
              <ArrowRight size={14} />
            </Button>
          )}
          <Button onClick={handleGetItems} disabled={fetching}>
            {fetching ? <Loader2 size={14} className="animate-spin" /> : null}
            {fetching ? "Fetching..." : "Get Items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
