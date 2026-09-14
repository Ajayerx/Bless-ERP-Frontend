import { useEffect, useState } from "react"
import { Printer } from "lucide-react"
import { Modal, ModalFooter, Button } from "@/components/ui"

/** Settings emitted by BulkPrintDialog — maps straight onto the doctype
 * service's buildMultiPdfUrl options. */
export interface PrintSettings {
  printFormat: string
  letterhead: string
  noLetterhead: boolean
  pageSize: string
  background: boolean
}

interface BulkPrintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dialog heading, e.g. "Print Sales Orders". */
  title: string
  /** Number of selected documents (drives the >25 Background Print hint). */
  count: number
  getPrintFormats?: () => Promise<string[]>
  getLetterHeads?: () => Promise<string[]>
  defaultPageSize?: string
  onPrint: (settings: PrintSettings) => void
}

const NO_LETTERHEAD = "No Letterhead"
const STANDARD = "Standard"
const PRINT_FORMAT_PLACEHOLDER = "Select Print Format"
const PAGE_SIZES = ["A4", "A3", "A5", "B5", "Letter", "Legal", "Ledger", "Executive"]

/** Mirrors frappe's `frappe.meta.get_print_formats`: Standard always first,
 * then the doctype's custom print formats sorted by name. */
function normalizePrintFormats(list: string[]): string[] {
  const custom = [...new Set(list)].filter((f) => f && f !== STANDARD).sort()
  return [STANDARD, ...custom]
}

export default function BulkPrintDialog({
  open,
  onOpenChange,
  title,
  count,
  getPrintFormats,
  getLetterHeads,
  defaultPageSize = "A4",
  onPrint,
}: BulkPrintDialogProps) {
  const [formats, setFormats] = useState<string[]>([])
  const [letterheads, setLetterheads] = useState<string[]>([])
  const [printFormat, setPrintFormat] = useState("")
  const [letterhead, setLetterhead] = useState(NO_LETTERHEAD)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [background, setBackground] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    setPrintFormat("")
    setLetterhead(NO_LETTERHEAD)
    setPageSize(defaultPageSize)
    setBackground(false)
    setFormats([])
    setLetterheads([])

    getPrintFormats?.()
      .then((list) => {
        if (cancelled) return
        const next = normalizePrintFormats(list)
        setFormats(next)
        setPrintFormat(next.includes(STANDARD) ? STANDARD : next[0] ?? "")
      })
      .catch(() => {
        if (!cancelled) {
          setFormats([STANDARD])
          setPrintFormat(STANDARD)
        }
      })
    getLetterHeads?.()
      .then((list) => {
        if (!cancelled) setLetterheads(Array.isArray(list) ? list : [])
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [open, getPrintFormats, getLetterHeads, defaultPageSize])

  const handlePrint = () => {
    const noLetterhead = letterhead === NO_LETTERHEAD
    onPrint({
      printFormat: printFormat || formats[0] || STANDARD,
      letterhead: noLetterhead ? "" : letterhead,
      noLetterhead,
      pageSize,
      background,
    })
    onOpenChange(false)
  }

  const selectClass =
    "w-full h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
    >
      <label className="block text-xs font-semibold text-muted mb-1.5">Letter Head</label>
      <select value={letterhead} onChange={(e) => setLetterhead(e.target.value)} className={selectClass}>
        <option value={NO_LETTERHEAD}>{NO_LETTERHEAD}</option>
        {letterheads.map((lh) => (
          <option key={lh} value={lh}>{lh}</option>
        ))}
      </select>

      <label className="block text-xs font-semibold text-muted mb-1.5 mt-3">Print Format</label>
      <select value={printFormat} onChange={(e) => setPrintFormat(e.target.value)} className={selectClass}>
        {formats.length === 0 && (
          <option value="" disabled>{PRINT_FORMAT_PLACEHOLDER}</option>
        )}
        {formats.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      <label className="block text-xs font-semibold text-muted mb-1.5 mt-3">Page Size</label>
      <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} className={selectClass}>
        {PAGE_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {count > 25 && (
        <label className="flex items-start gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={background}
            onChange={(e) => setBackground(e.target.checked)}
            className="accent-primary-600 mt-0.5"
          />
          <span className="text-sm text-body">
            Background Print
            <span className="block text-xs text-muted">Required for &gt;25 documents</span>
          </span>
        </label>
      )}

      <ModalFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handlePrint}>
          <Printer size={14} /> Print
        </Button>
      </ModalFooter>
    </Modal>
  )
}