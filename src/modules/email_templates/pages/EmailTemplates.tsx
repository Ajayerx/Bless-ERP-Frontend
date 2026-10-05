"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { AlertCircle, Plus, Pencil, Trash2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import {
  Button,
  Card,
  CardContent,
  ConfirmationDialog,
  EmptyState,
  Input,
  Skeleton,
  useMessageDialog,
  messageFromError,
} from "@/components/ui"
import { emailTemplateService } from "../services"
import type { EmailTemplate, EmailTemplateListResponse } from "../types"
import EmailTemplateFormDialog from "../components/EmailTemplateFormDialog"

type StatusFilter = "all" | "enabled" | "disabled"

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
]

export default function EmailTemplates() {
  const { showMessage } = useMessageDialog()
  const [data, setData] = useState<EmailTemplateListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [pendingDelete, setPendingDelete] = useState<EmailTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editLoading, setEditLoading] = useState("")

  /**
   * The list deliberately omits `response`, so the full record is fetched
   * before the edit form opens. That keeps an existing body from being wiped
   * on save.
   */
  const handleEdit = async (row: EmailTemplate) => {
    setEditLoading(row.name)
    try {
      setEditing(await emailTemplateService.getById(row.name))
    } catch {
      setEditing(row)
      showMessage("Could not load the full template; editing the list data instead.")
    } finally {
      setEditLoading("")
      setFormOpen(true)
    }
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setData(
        await emailTemplateService.list({
          search: search || undefined,
          status: status === "all" ? undefined : status,
          pageSize: 0,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load email templates.")
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await emailTemplateService.delete(pendingDelete.name)
      showMessage(`Deleted Email Template ${pendingDelete.template_name || pendingDelete.name}.`)
      setPendingDelete(null)
      await fetchData()
    } catch (err) {
      showMessage(messageFromError(err, "Failed to delete Email Template."))
    } finally {
      setDeleting(false)
    }
  }

  const items = data?.items ?? []

  return (
    <>
      <Topbar />

      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-heading">Email Templates</h1>
            <p className="text-sm text-muted mt-1">
              Reusable subject and body for invoices, quotations and payment requests.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus size={16} />
            New Email Template
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by template name"
                className="max-w-xs"
                aria-label="Search email templates"
              />
              <div className="flex items-center gap-1">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setStatus(tab.value)}
                    className={`px-3 py-1.5 rounded-[8px] text-sm transition-colors ${
                      status === tab.value
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-muted hover:bg-gray-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {data && (
                <span className="text-xs text-muted ml-auto">
                  {data.total} template{data.total === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                title="No email templates"
                description="Create a template to pre-fill the subject and body of emails."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-3 py-2 font-medium">Template</th>
                      <th className="px-3 py-2 font-medium">Subject</th>
                      <th className="px-3 py-2 font-medium">HTML</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t) => (
                      <tr key={t.name} className="border-t border-border">
                        <td className="px-3 py-2.5 text-body font-medium">
                          {t.template_name || t.name}
                          <p className="text-xs text-muted font-normal">{t.name}</p>
                        </td>
                        <td className="px-3 py-2.5 text-body max-w-[22rem] truncate">
                          {t.subject || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-body">{t.use_html ? "Yes" : "No"}</td>
                        <td className="px-3 py-2.5 text-body">
                          {t.enabled ? "Enabled" : "Disabled"}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={editLoading === t.name}
                              onClick={() => void handleEdit(t)}
                            >
                              <Pencil size={13} />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDelete(t)}
                            >
                              <Trash2 size={13} />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <EmailTemplateFormDialog
        open={formOpen}
        template={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => void fetchData()}
      />

      <ConfirmationDialog
        open={!!pendingDelete}
        title="Delete Email Template"
        description={
          pendingDelete
            ? `Delete ${pendingDelete.template_name || pendingDelete.name}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null)
        }}
      />
    </>
  )
}