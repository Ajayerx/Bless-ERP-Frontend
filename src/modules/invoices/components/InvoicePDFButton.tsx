import { useState } from "react"
import { Printer, Download, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui"
import { invoiceService } from "../services"
import type { SalesInvoice } from "../types"
import SendInvoiceEmailDialog from "./SendInvoiceEmailDialog"
import PrintPreviewDialog from "./PrintPreviewDialog"

interface Props {
  invoice: SalesInvoice
}

export default function InvoicePDFButton({ invoice }: Props) {
  const [downloading, setDownloading] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [pdfError, setPdfError] = useState("")
  const isDraft = invoice.docstatus === 0
  const isCancelled = invoice.docstatus === 2
  // Frappe's printview rejects drafts and cancelled docs (403) unless the
  // matching Print Settings flag is enabled — block up front with a reason.
  const printBlocked = isDraft || isCancelled
  const blockedTitle = isDraft ? "Submit invoice first" : "Cancelled invoices cannot be printed"

  const handlePDF = async () => {
    setDownloading(true)
    setPdfError("")
    try {
      const blob = await invoiceService.generatePDF(invoice.name, {
        printFormat: invoice.select_print_heading || undefined,
        letterHead: invoice.letter_head || undefined,
        language: invoice.language || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${invoice.name}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Failed to generate PDF")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewOpen(true)}
          disabled={printBlocked}
          title={printBlocked ? blockedTitle : "Print preview"}
        >
          <Printer size={14} /> Print
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePDF}
          disabled={printBlocked || downloading}
          title={printBlocked ? blockedTitle : "Download PDF"}
        >
          {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {downloading ? "Generating..." : "PDF"}
        </Button>
        <Button
          size="sm"
          onClick={() => setEmailOpen(true)}
          disabled={printBlocked}
          title={printBlocked ? blockedTitle : "Send via email"}
        >
          <Send size={14} /> Send
        </Button>
      </div>

      {pdfError && (
        <p className="text-xs text-danger-600 bg-danger-50 border border-danger-100 px-3 py-1.5 rounded-[8px]">
          {pdfError}
        </p>
      )}

      <PrintPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        invoiceName={invoice.name}
        printFormat={invoice.select_print_heading || undefined}
        letterHead={invoice.letter_head || undefined}
        language={invoice.language || undefined}
      />

      <SendInvoiceEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        invoiceName={invoice.name}
        contactEmail={invoice.contact_email}
      />
    </>
  )
}
