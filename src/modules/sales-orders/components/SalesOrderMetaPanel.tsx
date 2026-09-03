"use client"

import { useEffect, useState, useCallback } from "react"
import { Check, X, UserRound, Tag, UserPlus, Plus, PanelLeftClose } from "lucide-react"
import {
  Avatar,
  Button,
  Input,
  LinkSearchField,
  Skeleton,
  useMessageDialog,
  messageFromError,
} from "@/components/ui"
import type { DocInfoAssignment, DocInfoUserInfo } from "@/modules/payments/types"
import { salesOrderService } from "../services"
import { useAuth } from "@/context/AuthContext"

interface SalesOrderMetaPanelProps {
  name: string
  /** Collapse the panel (shown as a chevron at its top-right corner). */
  onCollapse?: () => void
}

function displayName(userId: string, userInfo: DocInfoUserInfo): string {
  return userInfo[userId]?.fullname || userInfo[userId]?.first_name || userId
}

// ERPNext's form sidebar (Assignments + Tags) as a compact left column, wired to
// the Sales Order module's service. Mirrors sidebar/assign_to.js and
// ui/tag_editor.js; every mutation refetches get_docinfo from the server.
export default function SalesOrderMetaPanel({ name, onCollapse }: SalesOrderMetaPanelProps) {
  const { user } = useAuth()
  const currentUserId = user?.id ?? null
  const { showMessage } = useMessageDialog()

  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<DocInfoAssignment[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [userInfo, setUserInfo] = useState<DocInfoUserInfo>({})
  const [canWrite, setCanWrite] = useState(false)

  const [acting, setActing] = useState(false)
  const [assignee, setAssignee] = useState("")
  const [tagQuery, setTagQuery] = useState("")
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [tagOpen, setTagOpen] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const doc = await salesOrderService.getDocInfo(name)
      setAssignments(doc.assignments ?? [])
      setTags(
        (doc.tags ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      )
      setUserInfo(doc.user_info ?? {})
      setCanWrite(!!doc.permissions?.write)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to load assignments and tags."))
    } finally {
      setLoading(false)
    }
  }, [name, showMessage])

  useEffect(() => {
    reload()
  }, [reload])

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setActing(true)
      try {
        await action()
        await reload()
      } catch (err) {
        showMessage(messageFromError(err, "Action failed."))
      } finally {
        setActing(false)
      }
    },
    [reload, showMessage]
  )

  const handleAssign = () => {
    const value = assignee.trim()
    if (!value) return
    run(() => salesOrderService.assignUserToDoc(name, value)).then(() => setAssignee(""))
  }

  const handleRemove = (userId: string) => run(() => salesOrderService.unassignUserFromDoc(name, userId))

  const handleDone = (userId: string) => run(() => salesOrderService.completeOwnAssignment(name, userId))

  const handleAddTag = (raw: string) => {
    const value = raw.trim()
    if (!value) return
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setTagQuery("")
      setTagOpen(false)
      return
    }
    run(() => salesOrderService.addTagToDoc(name, value)).then(() => {
      setTagQuery("")
      setTagOpen(false)
    })
  }

  const handleRemoveTag = (tag: string) => run(() => salesOrderService.removeTagFromDoc(name, tag))

  // Existing-Tag suggestions (TagEditor autocompletes from the Tag master).
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      salesOrderService.searchTags(tagQuery).then((suggestions) => {
        if (!cancelled) setTagSuggestions(suggestions)
      })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tagQuery])

  if (loading) {
    return (
      <aside className="hidden md:block w-[272px] shrink-0">
        <div className="bg-white rounded-2xl shadow-card p-5 space-y-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
        </div>
      </aside>
    )
  }

  const sectionSize = (icon: React.ReactNode, label: string) => (
    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
      {icon}
      {label}
    </h3>
  )

  return (
    <aside className="hidden md:block w-[272px] shrink-0">
      <div className="bg-white rounded-2xl shadow-card p-5 space-y-5 sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-heading">Assignments &amp; Tags</h2>
            <p className="text-[11px] text-muted mt-0.5">Mirrors ERPNext's form sidebar.</p>
          </div>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              title="Hide sidebar"
              aria-label="Hide assignments & tags sidebar"
              className="p-1.5 text-muted hover:text-body hover:bg-gray-100 rounded-lg transition-colors"
            >
              <PanelLeftClose size={14} />
            </button>
          )}
        </div>

        <section className="space-y-2.5">
          {sectionSize(<UserRound size={12} />, "Assigned To")}
          {assignments.length === 0 ? (
            <p className="text-xs text-muted">Unassigned</p>
          ) : (
            <ul className="space-y-1.5">
              {assignments.map((a) => {
                const userId = a.owner
                const fullName = displayName(userId, userInfo)
                const mine = currentUserId === userId
                const removable = mine || canWrite
                return (
                  <li
                    key={a.name}
                    className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-gray-50 transition-colors group"
                  >
                    <Avatar
                      name={fullName}
                      size="sm"
                      src={userInfo[userId]?.image || undefined}
                      className="ring-2 ring-surface"
                    />
                    <span className="flex-1 min-w-0 truncate text-sm text-body">{fullName}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {mine && (
                        <button
                          type="button"
                          onClick={() => handleDone(userId)}
                          title="Mark as done"
                          className="p-1 text-success-600 hover:bg-success-50 rounded-md"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {removable && (
                        <button
                          type="button"
                          onClick={() => handleRemove(userId)}
                          title="Remove assignment"
                          className="p-1 text-muted hover:text-danger-600 hover:bg-danger-50 rounded-md"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex items-center gap-2 pt-1">
            <LinkSearchField
              value={assignee || undefined}
              onChange={(v) => setAssignee(v ?? "")}
              searchFn={(query) =>
                salesOrderService.searchAssignableUsers(query).then((users) => ({
                  items: users.map((u) => ({ value: u.value, label: u.label, description: u.value })),
                }))
              }
              placeholder="Search user..."
              className="flex-1"
              inputClassName="py-2"
              clearIconMode="hover"
            />
            <Button variant="secondary" size="sm" onClick={handleAssign} loading={acting} disabled={!assignee.trim()}>
              <UserPlus size={14} /> Add
            </Button>
          </div>
        </section>

        <section className="space-y-2.5">
          {sectionSize(<Tag size={12} />, "Tags")}
          {tags.length === 0 ? (
            <p className="text-xs text-muted">No tags</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    title={`Remove tag ${tag}`}
                    className="hover:text-danger-600 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <Input
              value={tagQuery}
              onChange={(e) => {
                setTagQuery(e.target.value)
                setTagOpen(true)
              }}
              onFocus={() => setTagOpen(true)}
              onBlur={() => setTagOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddTag(tagQuery)
                }
              }}
              placeholder="Add a tag..."
              className="w-full pr-9"
            />
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleAddTag(tagQuery)
              }}
              title="Add tag"
              aria-label="Add tag"
              disabled={!tagQuery.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-primary-700 hover:bg-primary-50 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
            </button>
            {tagOpen && tagSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
                {tagSuggestions.slice(0, 8).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleAddTag(suggestion)
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {tagOpen && tagQuery.trim() && !tagSuggestions.some((s) => s.toLowerCase() === tagQuery.trim().toLowerCase()) && (
              <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleAddTag(tagQuery)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors text-primary-700 font-medium"
                >
                  + Create tag &ldquo;{tagQuery.trim()}&rdquo;
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  )
}
