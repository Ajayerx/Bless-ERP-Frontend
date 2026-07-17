import { useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import type { WidgetDefinition, WidgetState } from "../hooks/useDashboardWidgets"
import { KPI_DEFINITIONS, type KpiKey } from "../hooks/useKpiVisibility"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  widgets: WidgetDefinition[]
  orderedWidgets: WidgetState[]
  onToggle: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onReset?: () => void
  isKpiVisible: (key: KpiKey) => boolean
  onToggleKpi: (key: KpiKey) => void
}

function SortableWidgetRow({
  widget,
  isVisible,
  onToggle,
}: {
  widget: WidgetDefinition
  isVisible: boolean
  onToggle: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2.5 rounded-[10px] transition-colors text-left",
        isDragging ? "bg-gray-50 shadow-md" : "hover:bg-gray-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 p-1 rounded-md hover:bg-gray-100 cursor-grab active:cursor-grabbing text-muted hover:text-heading transition-colors"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      <span className="flex-1 text-sm font-medium text-body">{widget.label}</span>
      <button
        onClick={() => onToggle(widget.id)}
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors shrink-0",
          isVisible ? "bg-primary-500" : "bg-gray-200"
        )}
      >
        <div
          className={cn(
            "w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform mt-[3px]",
            isVisible ? "translate-x-[18px]" : "translate-x-[3px]"
          )}
        />
      </button>
    </div>
  )
}

export default function WidgetSettingsPanel({
  open,
  onOpenChange,
  widgets,
  orderedWidgets,
  onToggle,
  onReorder,
  onReset,
  isKpiVisible,
  onToggleKpi,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sorted = [...orderedWidgets].sort((a, b) => a.order - b.order)
  const widgetIds = sorted.map((w) => w.id)

  // Build ordered widget definitions (only visible ones for reorder)
  const orderedDefs = sorted
    .map((w) => widgets.find((def) => def.id === w.id))
    .filter(Boolean) as WidgetDefinition[]

  // Hidden widgets (not in orderedWidgets)
  const hiddenWidgets = widgets.filter(
    (w) => !orderedWidgets.some((ow) => ow.id === w.id)
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = widgetIds.indexOf(active.id as string)
    const newIndex = widgetIds.indexOf(over.id as string)
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin -mx-6 px-6">
          {/* KPI Cards toggles */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              KPI Cards
            </p>
            <div className="space-y-0.5">
              {KPI_DEFINITIONS.map((def) => (
                <div
                  key={def.key}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[10px] hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-6 shrink-0" />
                  <span className="flex-1 text-sm font-medium text-body">{def.label}</span>
                  <button
                    onClick={() => onToggleKpi(def.key as KpiKey)}
                    className={cn(
                      "relative w-9 h-5 rounded-full transition-colors shrink-0",
                      isKpiVisible(def.key as KpiKey) ? "bg-primary-500" : "bg-gray-200"
                    )}
                  >
                    <div
                      className={cn(
                        "w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform mt-[3px]",
                        isKpiVisible(def.key as KpiKey) ? "translate-x-[18px]" : "translate-x-[3px]"
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Visible widgets - sortable */}
          {orderedDefs.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Active Widgets
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={widgetIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-0.5">
                    {orderedDefs.map((w) => (
                      <SortableWidgetRow
                        key={w.id}
                        widget={w}
                        isVisible={true}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Hidden widgets - not sortable, just toggle to add */}
          {hiddenWidgets.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Available Widgets
              </p>
              <div className="space-y-0.5">
                {hiddenWidgets.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[10px] hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-6 shrink-0" /> {/* spacer for grip handle alignment */}
                    <span className="flex-1 text-sm font-medium text-muted">{w.label}</span>
                    <button
                      onClick={() => onToggle(w.id)}
                      className="relative w-9 h-5 rounded-full bg-gray-200 transition-colors shrink-0"
                    >
                      <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform translate-x-[3px] mt-[3px]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {onReset && (
          <div className="pt-3 mt-3 border-t border-border">
            <button
              onClick={onReset}
              className="w-full px-3 py-2 text-sm font-medium text-muted hover:text-red-600 hover:bg-red-50 rounded-[10px] transition-colors"
            >
              Reset to Default
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
