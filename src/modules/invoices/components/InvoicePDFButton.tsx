"use client"

import { Printer, Download, Send } from "lucide-react"
import { Button } from "@/components/ui"

const STUB_TOOLTIP = "Available in Week 5"

export default function InvoicePDFButton() {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled title={STUB_TOOLTIP}>
        <Printer size={14} /> Print
      </Button>
      <Button variant="outline" size="sm" disabled title={STUB_TOOLTIP}>
        <Download size={14} /> PDF
      </Button>
      <Button size="sm" disabled title={STUB_TOOLTIP}>
        <Send size={14} /> Send
      </Button>
    </div>
  )
}
