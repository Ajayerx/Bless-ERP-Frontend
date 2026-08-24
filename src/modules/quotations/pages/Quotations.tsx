"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Trash2, UserRound, Tag } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Modal, ModalFooter, Input, useToast } from "@/components/ui"
import { useMessageDialog, messageFromError, LinkSearchField } from "@/components/ui"
import { quotationService, type Quotation, type QuotationListResponse } from "@/services"
import QuotationTable from "../components/QuotationTable"

const QUOTATION_SORT_STORAGE_KEY = "blesserp_quotations_sort"

export default function Quotations() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { showMessage } = useMessageDialog()
  const [data, setData] = useState<QuotationListResponse | null>(null)
  const [allItems, setAllItems] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [start, setStart] = useState(0)
  const [pageLength, setPageLength] = useState(20)
  const [activeFilter, setActiveFilter] = useState("All")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [actingToolbar, setActingToolbar] = useState(false)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignee, setAssignee] = useState("")
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tagsInput, setTagsInput] = useState("")

  // Filter state
  const [customerSearch, setCustomerSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [validTillFrom, setValidTillFrom] = useState("")
  const [validTillTo, setValidTillTo] = useState("")
  const [assigneeFilter, setAssigneeFilter] = useState("")

  const [sortBy, setSortBy] = useState<string>(() => {
    try {
      return localStorage.getItem(QUOTATION_SORT_STORAGE_KEY)?.split("|")[0] || ""
    } catch {
      return ""
    }
  })
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    try {
      return (localStorage.getItem(QUOTATION_SORT_STORAGE_KEY)?.split("|")[1] as "asc" | "desc") || "desc"
    } catch {
      return "desc"
    }
  })

  const handleSort = (field: string, order: "asc" | "desc") => {
    setSortBy(field)
    setSortOrder(order)
    try {
      localStorage.setItem(QUOTATION_SORT_STORAGE_KEY, `${field}|${order}`)
    } catch {
      // ignore
    }
    setStart(0)
  }

  const hasActiveFilters =
    customerSearch !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    validTillFrom !== "" ||
    validTillTo !== "" ||
    assigneeFilter !== "" ||
    activeFilter !== "All" ||
    sortBy !== ""

  const resetFilters = () => {
    setCustomerSearch("")
    setDateFrom("")
    setDateTo("")
    setValidTillFrom("")
    setValidTillTo("")
    setAssigneeFilter("")
    setActiveFilter("All")
    setSortBy("")
    setSortOrder("desc")
    try {
      localStorage.removeItem(QUOTATION_SORT_STORAGE_KEY)
    } catch {
      // ignore
    }
    setStart(0)
  }

  const fetchData = useCallback(
    async (append = false) => {
      setLoading(true)
      setError("")
      try {
        const result = await quotationService.list({
          search: customerSearch,
          page: Math.floor((append ? start : 0) / pageLength) + 1,
          pageSize: pageLength,
          status: activeFilter === "All" ? undefined : activeFilter,
          transactionDateFrom: dateFrom || undefined,
          transactionDateTo: dateTo || undefined,
          validTillFrom: validTillFrom || undefined,
          validTillTo: validTillTo || undefined,
          assignedTo: assigneeFilter || undefined,
          sortBy: sortBy || undefined,
          sortOrder,
        })
        setData(result)
        setAllItems(result.items)
        if (!append) setStart(pageLength)
        else setStart((s) => s + pageLength)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load quotations")
      } finally {
        setLoading(false)
      }
    },
    [
      customerSearch,
      start,
      pageLength,
      activeFilter,
      dateFrom,
      dateTo,
      validTillFrom,
      validTillTo,
      assigneeFilter,
      sortBy,
      sortOrder,
    ]
  )

  useEffect(() => {
    setStart(0)
    fetchData(false)
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    customerSearch,
    activeFilter,
    dateFrom,
    dateTo,
    validTillFrom,
    validTillTo,
    pageLength,
    assigneeFilter,
    sortBy,
    sortOrder,
  ])

  const handleLoadMore = () => {
    fetchData(true)
  }

  const handlePageLengthChange = (size: number) => {
    setPageLength(size)
  }

  const selectedItems = useMemo(() => {
    return allItems.filter((q) => selectedKeys.has(q.name))
  }, [allItems, selectedKeys])

  const hasDraftSelected = useMemo(() => selectedItems.some((q) => q.docstatus === 0), [selectedItems])
  const hasCancelledSelected = useMemo(() => selectedItems.some((q) => q.docstatus === 2), [selectedItems])

  const handleBulkDelete = async () => {
    const names = Array.from(selectedKeys)
    setBulkLoading(true)
    setError("")
    try {
      for (const name of names) {
        await quotationService.delete(name)
      }
      addToast(`Deleted ${names.length} quotation${names.length === 1 ? "" : "s"} successfully`, "success")
      setSelectedKeys(new Set())
      setStart(0)
      fetchData()
    } catch (e) {
      showMessage(messageFromError(e, "Bulk delete failed"))
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkAssign = async (remove = false) => {
    const names = Array.from(selectedKeys)
    setAssignOpen(false)
    setActingToolbar(true)
    try {
      if (remove) {
        await quotationService.removeAssignment(names)
      } else if (!assignee.trim()) {
        throw new Error("Please enter an assignee.")
      } else {
        await quotationService.assignTo(names, assignee.trim())
      }
      showMessage(remove ? "Assignment cleared." : `Assigned ${names.length} quotation${names.length === 1 ? "" : "s"} to ${assignee.trim()}.`)
      setAssignee("")
    } catch (err) {
      showMessage(messageFromError(err, "Assignment failed."))
    } finally {
      setActingToolbar(false)
    }
  }

  const handleBulkAddTags = async () => {
    const names = Array.from(selectedKeys)
    setTagsOpen(false)
    setActingToolbar(true)
    try {
      const labels = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
      if (labels.length === 0) throw new Error("Please enter at least one tag.")
      for (const name of names) {
        for (const label of labels) {
          await quotationService.addTagToDoc(name, label)
        }
      }
      showMessage(`Added ${labels.length} tag${labels.length === 1 ? "" : "s"} to ${names.length} quotation${names.length === 1 ? "" : "s"}.`)
      setTagsInput("")
    } catch (err) {
      showMessage(messageFromError(err, "Adding tags failed."))
    } finally {
      setActingToolbar(false)
    }
  }

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Quotations</h1>
            <p className="text-sm text-muted mt-1">Create and manage customer quotations.</p>
          </div>
          <Button onClick={() => navigate("/quotations/new")}>
            <Plus size={16} />
            New Quotation
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-[14px] text-sm text-danger-700 whitespace-pre-line">
            {error}
          </div>
        )}

        <QuotationTable
          data={data}
          loading={loading || bulkLoading}
          page={Math.floor(start / pageLength) + 1}
          onPageChange={() => {}}
          activeFilter={activeFilter}
          onFilterChange={(f) => {
            setActiveFilter(f)
            setStart(0)
          }}
          onRowClick={(quotation) => navigate(`/quotations/${quotation.name}`)}
          customerSearch={customerSearch}
          onCustomerSearchChange={(v) => {
            setCustomerSearch(v)
            setStart(0)
          }}
          dateFrom={dateFrom}
          onDateFromChange={(v) => {
            setDateFrom(v)
            setStart(0)
          }}
          dateTo={dateTo}
          onDateToChange={(v) => {
            setDateTo(v)
            setStart(0)
          }}
          validTillFrom={validTillFrom}
          onValidTillFromChange={(v) => {
            setValidTillFrom(v)
            setStart(0)
          }}
          validTillTo={validTillTo}
          onValidTillToChange={(v) => {
            setValidTillTo(v)
            setStart(0)
          }}
          assignedTo={assigneeFilter}
          onAssigneeFilterChange={(v) => {
            setAssigneeFilter(v)
            setStart(0)
          }}
          sortField={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSort}
          onResetFilters={resetFilters}
          hasActiveFilters={hasActiveFilters}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          paginationMode="loadMore"
          currentPageLength={pageLength}
          onPageLengthChange={handlePageLengthChange}
          onLoadMore={handleLoadMore}
          toolbarActions={
            <div className="flex items-center gap-2">
              {(hasCancelledSelected || hasDraftSelected) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleBulkDelete()}
                  disabled={bulkLoading}
                  className="text-danger-600 border-danger-200 hover:bg-danger-50"
                >
                  <Trash2 size={14} /> Delete
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setAssignOpen(true)}>
                <UserRound size={14} /> Assign
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setTagsOpen(true)}>
                <Tag size={14} /> Add Tags
              </Button>
            </div>
          }
        />

        <Modal
          open={assignOpen}
          onClose={() => {
            setAssignOpen(false)
            setAssignee("")
          }}
          title="Assign Quotations"
          description={`Assign ${selectedKeys.size} selected quotation${selectedKeys.size === 1 ? "" : "s"} to a user, or clear the current assignment.`}
        >
          <LinkSearchField
            value={assignee || undefined}
            onChange={(v) => setAssignee(v ?? "")}
            searchFn={(query) =>
              quotationService.searchAssignableUsers(query).then((users) => ({
                items: users.map((u) => ({ value: u.value, label: u.label, description: u.description })),
              }))
            }
            placeholder="Type to search users..."
            required
            className="w-full"
            clearIconMode="hover"
          />
          <ModalFooter>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="ghost"
              className="text-danger-600 border border-danger-100 bg-danger-50 hover:bg-danger-100"
              onClick={() => handleBulkAssign(true)}
              loading={actingToolbar}
            >
              <UserRound size={14} /> Remove
            </Button>
            <Button onClick={() => handleBulkAssign(false)} loading={actingToolbar}>
              <UserRound size={14} /> Assign
            </Button>
          </ModalFooter>
        </Modal>

        <Modal
          open={tagsOpen}
          onClose={() => {
            setTagsOpen(false)
            setTagsInput("")
          }}
          title="Add Tags"
          description={`Add tags to ${selectedKeys.size} selected quotation${selectedKeys.size === 1 ? "" : "s"}. Separate tags with commas.`}
        >
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. Follow-up, Q3, Priority"
            className="w-full"
          />
          <ModalFooter>
            <Button variant="ghost" onClick={() => setTagsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAddTags} loading={actingToolbar}>
              <Tag size={14} /> Add Tags
            </Button>
          </ModalFooter>
        </Modal>
      </motion.div>
    </>
  )
}
