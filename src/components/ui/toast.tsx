import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastVariant = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  message: string
  variant?: ToastVariant
}

interface ToastContextType {
  addToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <AlertCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
}

const variantStyles: Record<ToastVariant, string> = {
  success: "bg-success-50 border-success-200 text-success-700",
  error: "bg-danger-50 border-danger-200 text-danger-700",
  warning: "bg-warning-50 border-warning-200 text-warning-700",
  info: "bg-info-50 border-info-200 text-info-700",
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-[14px] border shadow-lg max-w-sm",
        variantStyles[toast.variant ?? "info"],
      )}
    >
      <span className="shrink-0">{icons[toast.variant ?? "info"]}</span>
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X size={16} />
      </button>
    </motion.div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
