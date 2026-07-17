import { useState, useEffect, useRef } from "react"
import { Loader2, X, Printer, Download } from "lucide-react"
import { Dialog, DialogContent, Button } from "@/components/ui"
import { invoiceService } from "../services"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceName: string
  printFormat?: string
  letterHead?: string
  language?: string
}

export default function PrintPreviewDialog({
  open,
  onOpenChange,
  invoiceName,
  printFormat,
  letterHead,
  language,
}: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const blobRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open || !invoiceName) {
      return
    }

    let cancelled = false

    const fetchPdf = async () => {
      setLoading(true)
      setError(null)
      setPdfUrl(null)

      try {
        const blob = await invoiceService.generatePDF(invoiceName, {
          printFormat,
          letterHead,
          language,
        })
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        blobRef.current = url
        setPdfUrl(url)
      } catch {
        if (!cancelled) setError("Failed to generate print preview. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPdf()

    return () => {
      cancelled = true
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
    }
  }, [open, invoiceName, printFormat, letterHead, language])

  const handleClose = () => {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current)
      blobRef.current = null
    }
    setPdfUrl(null)
    setError(null)
    onOpenChange(false)
  }

  const handlePrint = () => {
    if (!pdfUrl) return
    const printWindow = window.open(pdfUrl, "_blank")
    printWindow?.addEventListener("loadend", () => {
      printWindow.print()
    })
  }

  const handleDownload = () => {
    if (!blobRef.current) return
    const a = document.createElement("a")
    a.href = blobRef.current
    a.download = `${invoiceName}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent hideClose className="max-w-4xl w-full h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-heading">
            Print Preview — {invoiceName}
          </h3>
          <div className="flex items-center gap-2">
            {pdfUrl && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download size={14} /> Download
              </Button>
            )}
            {pdfUrl && (
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer size={14} /> Print
              </Button>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 rounded-[8px] text-muted hover:text-heading hover:bg-gray-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 size={24} className="animate-spin text-primary-500" />
              <p className="text-sm text-muted">Generating preview...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <p className="text-sm text-danger-600">{error}</p>
              <Button variant="outline" size="sm" onClick={handleClose}>
                Close
              </Button>
            </div>
          )}

          {pdfUrl && (
            <iframe
              src={pdfUrl}
              title={`Print Preview — ${invoiceName}`}
              className="w-full h-full border-0"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
