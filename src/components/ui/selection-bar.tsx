import { AnimatePresence, motion } from "framer-motion"
import { Trash2, X } from "lucide-react"
import { Button } from "./button"

interface SelectionBarProps {
  count: number
  onDelete?: () => void
  onClearSelection: () => void
  label?: string
  loading?: boolean
}

function SelectionBar({
  count,
  onDelete,
  onClearSelection,
  label = "item",
  loading = false,
}: SelectionBarProps) {
  if (count <= 0) return null

  const pluralLabel = count === 1 ? label : `${label}s`

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between gap-4 px-6 py-3.5 bg-white border-t border-border shadow-lg"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-semibold">
            {count} {pluralLabel} selected
          </span>
          <button
            onClick={onClearSelection}
            className="p-1.5 rounded-[8px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
            title="Clear selection"
          >
            <X size={16} />
          </button>
        </div>
        {onDelete && (
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            loading={loading}
          >
            <Trash2 size={14} />
            Delete
          </Button>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export { SelectionBar }
export type { SelectionBarProps }
