import { useState } from "react"
import { XCircle } from "lucide-react"
import Modal from "./Modal"
import { Button } from "./button"
import { ApiError } from "@/services/api-client"
import { rewriteErpNextLinks } from "@/lib/utils"

interface BulkDeleteItem {
  name: string
  label: string
}

interface FailedItem {
  name: string
  label: string
  rawMessage: string
}

interface BulkDeleteModalProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
  items: BulkDeleteItem[]
  onDelete: (name: string) => Promise<void>
  doctypeLabel: string
}

type DeleteState = "confirm" | "deleting" | "done"

function BulkDeleteModal({
  open,
  onClose,
  onComplete,
  items,
  onDelete,
  doctypeLabel,
}: BulkDeleteModalProps) {
  const [state, setState] = useState<DeleteState>("confirm")
  const [failed, setFailed] = useState<FailedItem[]>([])
  const [deletedCount, setDeletedCount] = useState(0)
  const [currentLabel, setCurrentLabel] = useState("")

  const handleClose = () => {
    if (state === "deleting") return
    setState("confirm")
    setFailed([])
    setDeletedCount(0)
    setCurrentLabel("")
    onClose()
  }

  const handleConfirm = async () => {
    setState("deleting")
    const failedItems: FailedItem[] = []
    let deleted = 0

    for (const item of items) {
      setCurrentLabel(item.label)
      try {
        await onDelete(item.name)
        deleted++
      } catch (e) {
        failedItems.push({
          name: item.name,
          label: item.label,
          rawMessage: e instanceof ApiError
            ? e.rawMessage
            : e instanceof Error
              ? e.message
              : "Unknown error",
        })
      }
    }

    setDeletedCount(deleted)
    setFailed(failedItems)
    setState("done")
    onComplete()
  }

  const label = doctypeLabel
  const pluralLabel = items.length === 1 ? label : `${label}s`

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={state === "confirm" ? `Delete ${pluralLabel}` : state === "deleting" ? `Deleting ${pluralLabel}...` : `Delete ${pluralLabel} — Complete`}
    >
      {state === "confirm" && (
        <>
          <p>
            Are you sure you want to delete <strong>{items.length} {pluralLabel}</strong>?
          </p>
          <p className="text-sm text-muted mt-2">This action cannot be undone. The following items will be deleted:</p>
          <div className="mt-3 max-h-40 overflow-y-auto rounded-[10px] border border-border bg-gray-50 divide-y divide-border/50">
            {items.map((item) => (
              <div key={item.name} className="px-3 py-2 text-sm flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted bg-white px-1.5 py-0.5 rounded-[4px]">{item.name}</span>
                <span className="text-body truncate">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirm}>Delete {pluralLabel}</Button>
          </div>
        </>
      )}

      {state === "deleting" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted">
            Deleting <strong>{currentLabel}</strong>... ({deletedCount}/{items.length})
          </p>
        </div>
      )}

      {state === "done" && (
        <>
          {failed.length > 0 ? (
            <>
              <div className="space-y-3">
                <p className="text-sm text-body">
                  Successfully deleted <strong>{deletedCount}</strong> {deletedCount === 1 ? label : pluralLabel}.
                </p>
                <div className="rounded-lg border border-danger-200 bg-danger-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-100">
                      <XCircle size={14} className="text-danger-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-danger-700 mb-2">
                        {failed.length} {failed.length === 1 ? label : pluralLabel} could not be deleted
                      </p>
                      {failed.map((item) => (
                        <div key={item.name} className="mb-2 last:mb-0">
                          <p className="text-xs font-semibold text-danger-600 mb-1">{item.label}</p>
                          <div
                            className="text-sm text-danger-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: rewriteErpNextLinks(item.rawMessage) }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={handleClose}>Close</Button>
              </div>
            </>
          ) : (
            <>
              <p>
                Successfully deleted <strong>{deletedCount}</strong> {deletedCount === 1 ? label : pluralLabel}.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <Button onClick={handleClose}>Done</Button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

export { BulkDeleteModal }
export type { BulkDeleteModalProps, BulkDeleteItem }
