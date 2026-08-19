import { useState } from "react"
import { Link } from "react-router-dom"
import { Send, MessageSquare, Pencil, Trash2, X, Mail, Paperclip, ChevronDown, ChevronUp, Lock } from "lucide-react"
import { Avatar, Skeleton, ConfirmationDialog, useMessageDialog } from "@/components/ui"
import { useAutoGrowTextarea } from "@/hooks/useAutoGrowTextarea"
import { prettyDate, sanitizeHtml, htmlToText } from "@/lib/utils"
import type { PaymentActivityItem, ActivityMessageSegment, EmailAttachment } from "../types"
import { paymentService } from "../services"

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

// Mirrors frappe form_timeline.js set_communication_doc_status: map
// delivery_status to a badge colour (Sent/Opened/…/Error).
function deliveryStatusTheme(status?: string): { label: string; cls: string } {
  const s = status ?? ""
  if (["Sent", "Clicked"].includes(s)) return { label: s, cls: "bg-success-50 text-success-700 border-success-200" }
  if (["Opened", "Read"].includes(s)) return { label: s, cls: "bg-blue-50 text-blue-700 border-blue-200" }
  if (["Sending", "Scheduled"].includes(s)) return { label: s, cls: "bg-warning-50 text-warning-700 border-warning-200" }
  if (s === "Error") return { label: s, cls: "bg-danger-50 text-danger-700 border-danger-200" }
  return { label: status || "", cls: "bg-gray-100 text-gray-600 border-gray-200" }
}

function fileNameFromUrl(url: string): string {
  try {
    const decoded = decodeURIComponent(url)
    return decoded.split("/").filter(Boolean).pop() || url
  } catch {
    return url.split("/").filter(Boolean).pop() || url
  }
}

function EmailItem({ item }: { item: PaymentActivityItem }) {
  const [expanded, setExpanded] = useState(false)
  const [openingUrl, setOpeningUrl] = useState<string | null>(null)
  const { showMessage } = useMessageDialog()
  const { label: statusLabel, cls: statusCls } = deliveryStatusTheme(item.deliveryStatus)
  const attachments: EmailAttachment[] = item.attachments ?? []
  const body = item.content ?? ""
  const isLong = body.replace(/<[^>]*>/g, "").trim().length > 280

  async function handleOpenAttachment(fileUrl: string) {
    setOpeningUrl(fileUrl)
    try {
      const blob = await paymentService.openAttachment(fileUrl)
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, "_blank")
    } catch {
      showMessage("Failed to open attachment")
    } finally {
      setOpeningUrl(null)
    }
  }

  return (
    <div
      className="min-w-0 flex-1 rounded-[12px] border border-border bg-surface/60 p-3"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        <span className="font-semibold text-body">{item.senderName || item.senderEmail || "Unknown"}</span>
        {statusLabel && (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusCls}`}>
            {statusLabel}
          </span>
        )}
        <span className="text-muted">·</span>
        <span className="text-muted">{prettyDate(item.createdAt)}</span>
      </div>

      {item.subject && <p className="mt-1 text-sm font-semibold text-heading break-words">{item.subject}</p>}

      <div
        className={`mt-1.5 text-sm text-body/90 break-words [&_p]:my-1 [&_a]:text-primary-700 [&_a]:underline ${isLong && !expanded ? "line-clamp-4" : ""}`}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
      />
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
          data-testid={`email_body_toggle_${item.communicationName}`}
        >
          {expanded ? (
            <>
              <ChevronUp size={13} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={13} /> Show full email
            </>
          )}
        </button>
      )}

      {attachments.length > 0 && (
        <div className="mt-2.5 space-y-1 border-t border-border pt-2">
          {attachments.map((att, i) => (
            <a
              key={i}
              href={att.fileUrl}
              onClick={(e) => {
                e.preventDefault()
                void handleOpenAttachment(att.fileUrl)
              }}
              className="flex items-center gap-1.5 text-xs text-primary-700 hover:underline"
              data-testid={`email_attachment_${fileNameFromUrl(att.fileUrl)}`}
            >
              <Paperclip size={12} className="shrink-0" />
              <span className="truncate">{fileNameFromUrl(att.fileUrl)}</span>
              {att.isPrivate ? <Lock size={11} className="shrink-0 text-warning-500" /> : null}
              {openingUrl === att.fileUrl ? <span className="text-muted italic">Opening…</span> : null}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PaymentActivity({
  activity,
  loading,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  currentUserId,
}: {
  activity: PaymentActivityItem[]
  loading: boolean
  onAddComment: (content: string) => Promise<void>
  onUpdateComment: (commentName: string, content: string) => Promise<void>
  onDeleteComment: (commentName: string) => Promise<void>
  currentUserId: string | null
}) {
  const [content, setContent] = useState("")
  const [posting, setPosting] = useState(false)
  // ERPNext: the "Show all activity" switch is ON by default (versions visible);
  // turning it off collapses the feed to comments + created + last-edited.
  const [showAll, setShowAll] = useState(true)
  const textareaRef = useAutoGrowTextarea<HTMLTextAreaElement>()

  // ERPNext setup_comment_actions: edit/delete are only offered to the owner
  // (Administrator is handled server-side; the UI checks doc.owner).
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const hasComments = activity.some((item) => item.kind === "comment")
  const hasCommunications = hasComments || activity.some((item) => item.kind === "email")
  const visible = showAll ? activity : activity.filter((item) => item.kind !== "version")

  const submit = async () => {
    const text = content.trim()
    if (!text || posting) return
    setPosting(true)
    try {
      await onAddComment(text)
      setContent("")
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
      await onUpdateComment(editingName, text)
      cancelEdit()
    } finally {
      setSavingEdit(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDeleteComment(deleteTarget)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete comment.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-6" data-testid="payment_activity">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-primary-600" />
        <h2 className="text-base font-semibold text-heading">Comments &amp; Activity</h2>
      </div>

      <div className="flex items-start gap-3 mb-5">
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
          data-testid="activity_comment_input"
        />
        <button
          onClick={submit}
          disabled={posting || !content.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          data-testid="activity_add_button"
        >
          <Send size={14} />
          Add
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : activity.length === 0 ? (
        <p className="text-sm text-muted py-4 text-center">No comments or activity yet.</p>
      ) : (
        <>
          {/* "Activity" header + "Show all activity" toggle (hidden when there are no comments/emails, like ERPNext) */}
          {hasCommunications && (
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h4 className="text-sm font-semibold text-heading">Activity</h4>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted select-none">
                <span>Show all activity</span>
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                  className="peer sr-only"
                  data-testid="activity_show_all_toggle"
                />
                <span className="relative h-5 w-9 shrink-0 rounded-full bg-border transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-primary-600 peer-checked:after:translate-x-4" />
              </label>
            </div>
          )}

          <ul className="space-y-4">
            {visible.map((item) => (
              <li key={item.id} className="flex items-start gap-3" data-testid={`activity_item_${item.kind}`}>
                {item.kind === "comment" ? (
                  <Avatar name={item.authorAvatarName || item.authorName || ""} size="sm" />
                ) : item.kind === "email" ? (
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                    <Mail size={12} />
                  </span>
                ) : (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border" />
                )}
                <div className="min-w-0 flex-1">
                  {item.kind === "email" ? (
                    <EmailItem item={item} />
                  ) : item.kind === "comment" ? (
                    <>
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
                              data-testid={`edit_comment_${item.commentName}`}
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
                              data-testid={`delete_comment_${item.commentName}`}
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
                            data-testid={`edit_comment_input_${item.commentName}`}
                          />
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={saveEdit}
                              disabled={savingEdit || !editDraft.trim()}
                              className="inline-flex h-8 items-center rounded-[8px] bg-primary-600 px-3 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                              data-testid={`edit_comment_save_${item.commentName}`}
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={savingEdit}
                              className="inline-flex h-8 items-center gap-1 rounded-[8px] px-3 text-xs font-medium text-muted transition-colors hover:text-body"
                              data-testid={`edit_comment_dismiss_${item.commentName}`}
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
                    </>
                  ) : (
                    <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-body/80 break-words">
                      {item.kind === "version" && item.versionName ? (
                        <p className="min-w-0 break-words">
                          <Link
                            to={`/versions/${encodeURIComponent(item.versionName)}`}
                            className="text-primary-700 hover:underline"
                          >
                            {renderSegments(item.message)}
                          </Link>
                        </p>
                      ) : (
                        <p className="min-w-0 break-words">{renderSegments(item.message)}</p>
                      )}
                      <span className="text-muted">·</span>
                      <span className="text-muted whitespace-nowrap">{prettyDate(item.createdAt)}</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
