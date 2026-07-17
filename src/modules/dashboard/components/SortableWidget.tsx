import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WidgetSize } from "../hooks/useDashboardWidgets"

interface SortableWidgetProps {
  id: string
  size: WidgetSize
  children: React.ReactNode
}

const sizeClasses: Record<WidgetSize, string> = {
  full: "col-span-1 sm:col-span-2 lg:col-span-12",
  wide: "col-span-1 sm:col-span-2 lg:col-span-8",
  normal: "col-span-1 sm:col-span-1 lg:col-span-4",
}

export default function SortableWidget({ id, size, children }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        sizeClasses[size],
        "relative group/widget",
        isDragging && "ring-2 ring-primary-500/30 rounded-[16px]"
      )}
    >
      {/* Drag handle - visible on hover */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          "absolute -top-2 left-1/2 -translate-x-1/2 z-10",
          "w-8 h-6 rounded-lg bg-surface border border-border shadow-sm",
          "flex items-center justify-center",
          "opacity-0 group-hover/widget:opacity-100 transition-opacity cursor-grab active:cursor-grabbing",
          "hover:bg-gray-50 hover:border-gray-300"
        )}
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} className="text-muted" />
      </button>
      {children}
    </div>
  )
}

export function DragOverlayWidget({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] shadow-xl ring-2 ring-primary-500/20 opacity-90">
      {children}
    </div>
  )
}
