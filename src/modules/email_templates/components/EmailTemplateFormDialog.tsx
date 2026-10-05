"use client"

import { useEffect, useState } from "react"
import { Modal, ModalFooter, Button, Checkbox, Input, Textarea, useMessageDialog, messageFromError } from "@/components/ui"
import { emailTemplateService } from "../services"
import type { EmailTemplate, EmailTemplateFormData } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  /** Omit for "new"; pass the record for edit. */
  template?: EmailTemplate | null
  onSaved?: (template: EmailTemplate) => void
}

const EMPTY: EmailTemplateFormData = {
  template_name: "",
  subject: "",
  response: "",
  use_html: 0,
  enabled: 1,
}

export default function EmailTemplateFormDialog({ open, onClose, template, onSaved }: Props) {
  const { showMessage } = useMessageDialog()
  const [form, setForm] = useState<EmailTemplateFormData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    setSaving(false)
    if (template) {
      setForm({
        name: template.name,
        template_name: template.template_name ?? template.name,
        subject: template.subject ?? "",
        response: template.response ?? template.response_html ?? "",
        use_html: template.use_html ? 1 : 0,
        enabled: template.enabled ? 1 : 0,
      })
    } else {
      setForm({ ...EMPTY })
    }
  }, [open, template])

  const set = <K extends keyof EmailTemplateFormData>(key: K, value: EmailTemplateFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.template_name.trim()) {
      setError("Template name is required")
      return
    }
    setSaving(true)
    setError("")
    try {
      const saved = template
        ? await emailTemplateService.update(template.name, form)
        : await emailTemplateService.create(form)
      showMessage(template ? "Email Template updated." : "Email Template created.")
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const message = messageFromError(err, "Failed to save Email Template.")
      setError(typeof message === "string" ? message : message.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? `Edit ${template.template_name || template.name}` : "New Email Template"}
      description="Subject and body may reference document fields with {{doc.field}}."
    >
      <div className="space-y-4">
        <Input
          id="email-template-name"
          label="Template Name"
          value={form.template_name}
          onChange={(e) => set("template_name", e.target.value)}
          placeholder="e.g. Invoice Reminder"
        />

        <Input
          id="email-template-subject"
          label="Subject"
          value={form.subject ?? ""}
          onChange={(e) => set("subject", e.target.value)}
          placeholder="e.g. Invoice {{doc.name}} from {{doc.company}}"
        />

        <Textarea
          id="email-template-response"
          label="Message"
          rows={8}
          value={form.response ?? ""}
          onChange={(e) => set("response", e.target.value)}
          placeholder="<p>Dear {{doc.customer_name}},</p>"
        />

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-body">
            <Checkbox
              id="email-template-use-html"
              checked={!!form.use_html}
              onCheckedChange={(checked) => set("use_html", checked ? 1 : 0)}
            />
            Use HTML
          </label>
          <label className="flex items-center gap-2 text-sm text-body">
            <Checkbox
              id="email-template-enabled"
              checked={form.enabled === undefined ? true : !!form.enabled}
              onCheckedChange={(checked) => set("enabled", checked ? 1 : 0)}
            />
            Enabled
          </label>
        </div>

        {error && (
          <p className="text-xs text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[8px]">
            {error}
          </p>
        )}
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={saving}>
          {template ? "Save" : "Create"}
        </Button>
      </ModalFooter>
    </Modal>
  )
}