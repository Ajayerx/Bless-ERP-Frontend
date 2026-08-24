import { useState, useEffect } from "react"
import { Send, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui"
import { Button } from "@/components/ui"
import { invoiceService } from "../services"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceName: string
  contactEmail?: string
}

export default function SendInvoiceEmailDialog({
  open,
  onOpenChange,
  invoiceName,
  contactEmail,
}: Props) {
  const [recipients, setRecipients] = useState(contactEmail ?? "")
  const [subject, setSubject] = useState(`Invoice ${invoiceName}`)
  const [content, setContent] = useState(
    `Dear Customer,\n\nPlease find attached invoice ${invoiceName}.\n\nBest regards,\nBlessERP`
  )
  const [printFormats, setPrintFormats] = useState<string[]>(["Standard"])
  const [selectedFormat, setSelectedFormat] = useState("Standard")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setRecipients(contactEmail ?? "")
      setSubject(`Invoice ${invoiceName}`)
      setContent(
        `Dear Customer,\n\nPlease find attached invoice ${invoiceName}.\n\nBest regards,\nBlessERP`
      )
      setSelectedFormat("Standard")
      setSent(false)
      setError("")
      invoiceService.getPrintFormats().then(setPrintFormats).catch(() => {})
    }
  }, [open, invoiceName, contactEmail])

  const handleSend = async () => {
    if (!recipients.trim()) {
      setError("Recipient email is required")
      return
    }
    setSending(true)
    setError("")
    try {
      await invoiceService.sendEmail(invoiceName, {
        recipients: recipients.trim(),
        subject,
        content: content.replace(/\n/g, "<br>"),
        printFormat: selectedFormat,
      })
      setSent(true)
      setTimeout(() => onOpenChange(false), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Send Invoice {invoiceName}
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-success-600">Email sent successfully!</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-heading block mb-1.5">To</label>
              <input
                type="email"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="recipient@email.com"
                className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[10px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-heading block mb-1.5">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[10px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-heading block mb-1.5">Message</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[10px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-heading block mb-1.5">Print Format</label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[10px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {printFormats.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-body">
                  <input
                    type="checkbox"
                    checked
                    disabled
                    className="h-4 w-4 rounded border-border"
                  />
                  Attach PDF
                </label>
              </div>
            </div>

            {error && (
              <p className="text-xs text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[8px]">
                {error}
              </p>
            )}
          </div>
        )}

        {!sent && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending || !recipients.trim()}>
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
