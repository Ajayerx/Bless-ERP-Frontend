"use client"

import { Printer, Download, Send } from "lucide-react"
import { Button } from "@/components/ui"

interface InvoicePDFButtonProps {
  onPrint?: () => void
  onDownload?: () => void
  onSend?: () => void
}

export default function InvoicePDFButton({ onPrint, onDownload, onSend }: InvoicePDFButtonProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onPrint}>
        <Printer size={14} /> Print
      </Button>
      <Button variant="outline" size="sm" onClick={onDownload}>
        <Download size={14} /> PDF
      </Button>
      <Button size="sm" onClick={onSend}>
        <Send size={14} /> Send
      </Button>
    </div>
  )
}
