"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Link, useParams } from "react-router-dom"
import { Send, Pencil, Trash2, X } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import PageHead from "@/components/layout/PageHead"
import { Avatar, Skeleton, ConfirmationDialog } from "@/components/ui"
import { useMessageDialog, messageFromError } from "@/components/ui"
import { paymentService, buildTimelineItems, fieldLabel, type VersionDoc } from "@/services"
import { useAuth } from "@/context/AuthContext"
import { useAutoGrowTextarea } from "@/hooks/useAutoGrowTextarea"
import { prettyDate, sanitizeHtml, htmlToText } from "@/lib/utils"
import type { PaymentActivityItem, ActivityMessageSegment } from "../types"

// Shape of the parsed Version.data JSON (see version_timeline_content_builder.js).
interface VersionData {
  comment?: string
  comment_type?: string
  changed?: Array<[string, unknown, unknown]>
  added?: Array<[string, Record<string, unknown>]>
  removed?: Array<[string, Record<string, unknown>]>
  row_changed?: Array<[string, number, string, Array<[string, unknown, unknown]>]>
}

function parseData(raw: string): VersionData {
  try {
    return (JSON.parse(raw) ?? {}) as VersionData
  } catch {
    return {}
  }
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "null"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

// Convert a stored long-text value to readable text with real line breaks.
// Rich-text/long-text fields (e.g. remarks) store HTML where lines are
// separated by <br> / </p> / </div>, not "\n". Showing String(value) would
// print the raw "<br>" token — map those tags to newlines instead.
function multilineText(value: unknown): string {
  return displayValue(value)
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<\/div\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
}

// Renders a changed value as text with preserved line breaks (whitespace-pre-line),
// so <br>-separated remarks display on separate lines and never show a literal "<br>".
function renderValue(value: unknown): ReactNode {
  return <span className="whitespace-pre-line break-words">{multilineText(value)}</span>
}

// difflib treats <br>-separated (newline-less) long text as a single line, so the
// server html diff escapes the <br> tokens. Convert those back to real newlines so
// the diff table still reads line-by-line (rendered with white-space: pre-line).
function htmlDiffToLines(html: string): string {
  return html.replace(/&lt;br\s*\/?&gt;/gi, "\n")
}

function renderSegments(segments?: ActivityMessageSegment[]) {
  if (!segments || segments.length === 0) return null
  return (
    <>
      {segments.map((segment, i) =>
        segment.type === "bold" ? (
          <strong key={i} className="font-medium text-body">
            {segment.text}
          </strong>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  )
}

// Mirrors frappe/core/doctype/version/templates/version_view.html — the body of
// the Version form ERPNext opens when a timeline version message is clicked.
// Long text fields (e.g. remarks) carry a server-generated HTML diff in
// doc.__onload.html_diffs (Version.onload → difflib.HtmlDiff); those render in
// their own diff block, and only simple fields land in the Property table.
function VersionBody({
  raw,
  ref_doctype,
  html_diffs,
}: {
  raw: string
  ref_doctype: string
  html_diffs: Record<string, string>
}) {
  const data = parseData(raw)

  const changed = (data.changed ?? []).filter((item) => item && item.length >= 3)
  const simpleChanged = changed.filter((item) => !html_diffs[item[0]])
  const diffChanged = changed.filter((item) => html_diffs[item[0]])
  const rowsAdded = data.added ?? []
  const rowsRemoved = data.removed ?? []
  const rowsChanged = data.row_changed ?? []

  return (
    <div className="space-y-6">
      <style>{`
        .version-html-diff table.diff {
          width: 100%;
          border-collapse: collapse;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 12px;
          white-space: pre-line;
        }
        .version-html-diff table.diff th,
        .version-html-diff table.diff td {
          padding: 2px 6px;
          border: 1px solid var(--color-border);
          vertical-align: top;
        }
        .version-html-diff table.diff th {
          background-color: #f9fafb;
          font-weight: 500;
          padding: 6px;
        }
        .version-html-diff table.diff .diff_header {
          background-color: #f9fafb;
          text-align: right;
          width: 40px;
        }
        .version-html-diff table.diff .diff_next {
          background-color: #f9fafb;
          width: 10px;
        }
        .version-html-diff table.diff .diff_add { background-color: rgba(16, 185, 129, 0.15); }
        .version-html-diff table.diff .diff_chg { background-color: rgba(245, 158, 11, 0.18); }
        .version-html-diff table.diff .diff_sub { background-color: rgba(239, 68, 68, 0.12); }
        .version-html-diff table.diff colgroup { display: none; }
      `}</style>

      {data.comment && (
        <div>
          <h4 className="text-sm font-semibold text-heading mb-1">
            Comment ({data.comment_type})
          </h4>
          <p className="text-sm text-body">{data.comment}</p>
        </div>
      )}

      {changed.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-heading mb-2">Values Changed</h4>

          {diffChanged.map((item) => (
            <div key={item[0]} className="mb-4">
              <h5 className="text-sm font-medium text-heading mb-1">{fieldLabel(item[0])}</h5>
              <div
                className="version-html-diff"
                data-testid={`version_diff_${item[0]}`}
                dangerouslySetInnerHTML={{ __html: htmlDiffToLines(html_diffs[item[0]]) }}
              />
            </div>
          ))}

          {simpleChanged.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm" data-testid="version_simple_table">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-muted">
                    <td className="border border-border px-3 py-2 w-1/3">Property</td>
                    <td className="border border-border px-3 py-2 w-1/3">Original Value</td>
                    <td className="border border-border px-3 py-2 w-1/3">New Value</td>
                  </tr>
                </thead>
                <tbody>
                  {simpleChanged.map((item, i) => (
                    <tr key={i}>
                      <td className="border border-border px-3 py-2">{fieldLabel(item[0])}</td>
                      <td className="border border-border px-3 py-2 text-danger-700 bg-danger-50/40 break-words">
                        {renderValue(item[1])}
                      </td>
                      <td className="border border-border px-3 py-2 text-success-700 bg-success-50/40 break-words">
                        {renderValue(item[2])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {rowsAdded.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-heading mb-2">Rows Added</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-muted">
                  <td className="border border-border px-3 py-2 w-1/3">Property</td>
                  <td className="border border-border px-3 py-2 w-2/3">Rows Added</td>
                </tr>
              </thead>
              <tbody>
                {rowsAdded.map((item, i) => (
                  <tr key={i}>
                    <td className="border border-border px-3 py-2 align-top">{fieldLabel(item[0])}</td>
                    <td className="border border-border px-3 py-2">
                      <table className="w-full border-collapse">
                        <tbody>
                          {Object.keys(item[1] ?? {})
                            .sort()
                            .map((key) => (
                              <tr key={key} className="text-xs">
                                <td className="border border-border px-2 py-1 text-muted w-1/3">{key}</td>
                                <td className="border border-border px-2 py-1">{renderValue((item[1] ?? {})[key])}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rowsRemoved.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-heading mb-2">Rows Removed</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-muted">
                  <td className="border border-border px-3 py-2 w-1/3">Property</td>
                  <td className="border border-border px-3 py-2 w-2/3">Rows Removed</td>
                </tr>
              </thead>
              <tbody>
                {rowsRemoved.map((item, i) => (
                  <tr key={i}>
                    <td className="border border-border px-3 py-2 align-top">{fieldLabel(item[0])}</td>
                    <td className="border border-border px-3 py-2">
                      <table className="w-full border-collapse">
                        <tbody>
                          {Object.keys(item[1] ?? {})
                            .sort()
                            .map((key) => (
                              <tr key={key} className="text-xs">
                                <td className="border border-border px-2 py-1 text-muted w-1/3">{key}</td>
                                <td className="border border-border px-2 py-1">{renderValue((item[1] ?? {})[key])}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rowsChanged.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-heading mb-2">Row Values Changed</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-muted">
                  <td className="border border-border px-3 py-2 w-1/4">Table Field</td>
                  <td className="border border-border px-3 py-2 w-1/9">Row #</td>
                  <td className="border border-border px-3 py-2 w-1/5">Property</td>
                  <td className="border border-border px-3 py-2 w-1/5">Original Value</td>
                  <td className="border border-border px-3 py-2 w-1/5">New Value</td>
                </tr>
              </thead>
              <tbody>
                {rowsChanged.map((tableInfo) =>
                  (tableInfo[3] ?? []).map((item, i) => (
                    <tr key={`${tableInfo[0]}-${tableInfo[1]}-${i}`}>
                      <td className="border border-border px-3 py-2">{fieldLabel(tableInfo[0])}</td>
                      <td className="border border-border px-3 py-2">{tableInfo[1]}</td>
                      <td className="border border-border px-3 py-2">{item[0]}</td>
                      <td className="border border-border px-3 py-2 text-danger-700 bg-danger-50/40 break-words">
                        {renderValue(item[1])}
                      </td>
                      <td className="border border-border px-3 py-2 text-success-700 bg-success-50/40 break-words">
                        {renderValue(item[2])}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!data.comment && changed.length === 0 && rowsAdded.length === 0 && rowsRemoved.length === 0 && rowsChanged.length === 0 && (
        <p className="text-sm text-muted">No values were changed in this version.</p>
      )}
    </div>
  )
}

// ERPNext's form footer shows the standard Comments & Activity timeline for the
// Version document itself. We build it from get_docinfo + buildTimelineItems and
// split it into two sections: "Comments" (composer + existing comments) and
// "Activity" (created / last-edited / version messages).
function VersionFooter({
  version,
  currentUserId,
  currentUserEmail,
  currentUserName,
}: {
  version: VersionDoc
  currentUserId: string | null
  currentUserEmail: string
  currentUserName: string
}) {
  const [items, setItems] = useState<PaymentActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const { showMessage } = useMessageDialog()
  const [content, setContent] = useState("")
  const [posting, setPosting] = useState(false)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const textareaRef = useAutoGrowTextarea<HTMLTextAreaElement>()

  const refresh = async () => {
    try {
      const docinfo = await paymentService.getDocInfo(version.name, "Version")
      setItems(buildTimelineItems(version as never, docinfo, currentUserId ?? undefined))
    } catch (err) {
      showMessage(messageFromError(err, "Failed to load activity."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    paymentService
      .getDocInfo(version.name, "Version")
      .then((docinfo) => {
        if (!cancelled) setItems(buildTimelineItems(version as never, docinfo, currentUserId ?? undefined))
      })
      .catch((err) => {
        if (!cancelled) showMessage(messageFromError(err, "Failed to load activity."))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [version.name, currentUserId])

  const comments = items.filter((item) => item.kind === "comment")
  const activity = items.filter((item) => item.kind !== "comment")

  const submit = async () => {
    const text = content.trim()
    if (!text || posting) return
    setPosting(true)
    try {
      await paymentService.addComment(version.name, text, currentUserEmail, currentUserName, "Version")
      setContent("")
      await refresh()
    } finally {
      setPosting(false)
    }
  }

  const startEdit = (item: PaymentActivityItem) => {
    setEditingName(item.commentName ?? null)
    setEditDraft(htmlToText(item.content ?? ""))
  }

  const cancelEdit = () => {
    setEditingName(null)
    setEditDraft("")
  }

  const saveEdit = async () => {
    const text = editDraft.trim()
    if (!text || savingEdit || !editingName) return
    setSavingEdit(true)
    try {
      await paymentService.updateComment(editingName, text)
      cancelEdit()
      await refresh()
    } finally {
      setSavingEdit(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await paymentService.deleteComment(deleteTarget)
      setDeleteTarget(null)
      await refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete comment.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div data-testid="version_footer">
      <h4 className="text-sm font-semibold text-heading mb-3">Comments</h4>

      <div className="flex items-start gap-3 mb-4">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Add a comment..."
          rows={1}
          className="flex-1 resize-none overflow-hidden rounded-[12px] border border-border bg-white px-3 py-2.5 text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
          data-testid="version_comment_input"
        />
        <button
          onClick={submit}
          disabled={posting || !content.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          data-testid="version_comment_add"
        >
          <Send size={14} />
          Add
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <>
          {comments.length > 0 && (
            <ul className="space-y-4 mb-6">
              {comments.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <Avatar name={item.authorAvatarName || item.authorName || ""} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                      <span className="font-semibold text-body">{item.authorName}</span>
                      <span className="text-muted">commented</span>
                      <span className="text-muted">·</span>
                      <span className="text-muted">{prettyDate(item.createdAt)}</span>
                      {item.author === currentUserId && item.commentName && (
                        <span className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => startEdit(item)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-border/60 hover:text-body"
                            aria-label="Edit comment"
                            data-testid={`version_edit_comment_${item.commentName}`}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(item.commentName ?? null)
                              setDeleteError(null)
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger-50 hover:text-danger-600"
                            aria-label="Delete comment"
                            data-testid={`version_delete_comment_${item.commentName}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </span>
                      )}
                    </div>
                    {editingName === item.commentName ? (
                      <div className="mt-2">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={2}
                          autoFocus
                          className="w-full resize-none rounded-[12px] border border-border bg-white px-3 py-2 text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                          data-testid={`version_edit_comment_input_${item.commentName}`}
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={savingEdit || !editDraft.trim()}
                            className="inline-flex h-8 items-center rounded-[8px] bg-primary-600 px-3 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                            data-testid={`version_edit_comment_save_${item.commentName}`}
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={savingEdit}
                            className="inline-flex h-8 items-center gap-1 rounded-[8px] px-3 text-xs font-medium text-muted transition-colors hover:text-body"
                            data-testid={`version_edit_comment_dismiss_${item.commentName}`}
                          >
                            <X size={12} /> Dismiss
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="mt-1 text-sm text-body break-words"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content || "") }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {activity.length > 0 && (
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-heading mb-2">Activity</h4>
              <ul className="space-y-3">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border" />
                    <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-body/80 break-words">
                      <p className="min-w-0 break-words">{renderSegments(item.message)}</p>
                      <span className="text-muted">·</span>
                      <span className="text-muted whitespace-nowrap">{prettyDate(item.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {comments.length === 0 && activity.length === 0 && (
            <p className="text-sm text-muted py-2 text-center">No comments or activity yet.</p>
          )}
        </>
      )}

      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
        onConfirm={confirmDelete}
        title="Delete comment?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        error={deleteError}
      />
    </div>
  )
}

export default function VersionDetail() {
  const { id } = useParams<{ id: string }>()
  const { showMessage } = useMessageDialog()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null
  const [version, setVersion] = useState<VersionDoc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    paymentService
      .getVersion(id)
      .then((v) => {
        if (!cancelled) setVersion(v)
      })
      .catch((err) => {
        if (!cancelled) showMessage(messageFromError(err, "Failed to load the version record."))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  if (!version) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center text-muted">Version not found</div>
      </>
    )
  }

  const backTo = version.docname ? `/payments/${encodeURIComponent(version.docname)}` : "/payments"

  return (
    <>
      <Topbar />
      <PageHead
        eyebrow="Version"
        title={version.name}
        subtitle="System version record"
        backTo={backTo}
      />
      <div className="p-6 max-w-3xl space-y-6">
        <div className="bg-white rounded-2xl shadow-card p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-6">
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-muted">DocType</dt>
              <dd className="text-sm text-body font-medium">{version.ref_doctype}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-muted">Document Name</dt>
              <dd className="text-sm text-body font-medium break-all">
                <Link to={backTo} className="text-primary-700 hover:underline">
                  {version.docname}
                </Link>
              </dd>
            </div>
          </dl>
          <VersionBody
            raw={version.data}
            ref_doctype={version.ref_doctype}
            html_diffs={version.__onload?.html_diffs ?? {}}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-card p-6">
          <VersionFooter
            version={version}
            currentUserId={currentUserId}
            currentUserEmail={user?.id ?? ""}
            currentUserName={user?.name ?? ""}
          />
        </div>
      </div>
    </>
  )
}
