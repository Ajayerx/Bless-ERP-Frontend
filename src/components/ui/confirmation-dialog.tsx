import { AlertTriangle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog"

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning"
  onConfirm: () => void
  loading?: boolean
  error?: string | null
}

function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  loading,
  error,
}: ConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                variant === "danger" ? "bg-danger-100" : "bg-warning-100"
              )}
            >
              <AlertTriangle
                size={20}
                className={variant === "danger" ? "text-danger-600" : "text-warning-600"}
              />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-0">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {error && (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmationDialog }
export type { ConfirmationDialogProps }
