"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { Select } from "@/components/ui"
import { emailTemplateService } from "../services"

interface Props {
  /** The document the template is rendered against. */
  doc: Record<string, unknown>
  value: string
  onChange: (templateName: string) => void
  onRendered?: (rendered: { subject: string; message: string }) => void
  label?: string
  disabled?: boolean
  /** Shown when the caller has already populated the fields by hand. */
  placeholder?: string
}

/**
 * Template dropdown for the send-email dialogs. Picking a template calls
 * `get_email_template` and hands the rendered subject/body back to the caller,
 * which decides whether to keep the body as HTML or convert it to plain text.
 */
export default function EmailTemplatePicker({
  doc,
  value,
  onChange,
  onRendered,
  label = "Template",
  disabled,
  placeholder = "No template",
}: Props) {
  const [names, setNames] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)
  const selectId = useId()

  useEffect(() => {
    mounted.current = true
    emailTemplateService
      .names()
      .then((list) => {
        if (mounted.current) setNames(list)
      })
      .catch(() => {})
    return () => {
      mounted.current = false
    }
  }, [])

  const handleChange = async (name: string) => {
    onChange(name)
    if (!name || !onRendered) return
    setLoading(true)
    try {
      const rendered = await emailTemplateService.render(name, doc)
      if (!mounted.current) return
      if (rendered) onRendered(rendered)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Select
          id={selectId}
          label={label}
          value={value}
          disabled={disabled || loading}
          onChange={(e) => void handleChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
      {loading && <Loader2 size={14} className="mb-3 shrink-0 animate-spin text-muted" />}
    </div>
  )
}