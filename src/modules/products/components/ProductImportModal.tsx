"use client"
import { useState, useRef } from "react"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import Modal, { ModalFooter } from "@/components/ui/Modal"
import { productService } from "@/services"

interface Props {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

export default function ProductImportModal({ open, onClose, onComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState("")

  const reset = () => {
    setFile(null)
    setResult(null)
    setError("")
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  const handleClose = () => {
    if (result) onComplete()
    reset()
    onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (!selected.name.endsWith(".csv")) {
        setError("Please select a CSV file.")
        return
      }
      setFile(selected)
      setResult(null)
      setError("")
    }
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setError("")
    try {
      const res = await productService.importFromCsv(file)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.")
    } finally {
      setImporting(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2 bg-white border border-border rounded-[10px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"

  return (
    <Modal open={open} onClose={handleClose} title="Import Products" size="md">
      <div className="space-y-4">
        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[10px]">
            {error}
          </p>
        )}

        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-success-50 border border-success-100 rounded-[10px]">
              <CheckCircle size={18} className="text-success-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-heading">{result.success} product{result.success !== 1 ? "s" : ""} imported</p>
                {result.failed > 0 && (
                  <p className="text-xs text-muted">{result.failed} failed</p>
                )}
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-danger-600">
                    <XCircle size={12} className="mt-0.5 shrink-0" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted mb-3">
              Upload a CSV file with columns: <strong>item_code</strong> or <strong>item_name</strong> (at least one required), item_group, stock_uom, brand, description, standard_rate, is_stock_item
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className={inputClass + " file:mr-3 file:py-1 file:px-3 file:rounded-[8px] file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100"}
            />
            {file && (
              <p className="text-xs text-muted mt-2">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>
        )}
      </div>

      <ModalFooter>
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 text-sm font-semibold text-muted bg-white border border-border rounded-[10px] hover:bg-gray-50 transition-colors"
        >
          {result ? "Done" : "Cancel"}
        </button>
        {!result && (
          <button
            type="button"
            onClick={handleImport}
            disabled={!file || importing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-50 bg-primary-600 rounded-[10px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {importing && <Loader2 size={14} className="animate-spin" />}
            {importing ? "Importing..." : "Import"}
          </button>
        )}
      </ModalFooter>
    </Modal>
  )
}
