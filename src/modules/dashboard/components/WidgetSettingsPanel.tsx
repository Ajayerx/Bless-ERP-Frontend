import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui"
import type { WidgetDefinition } from "../hooks/useDashboardWidgets"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  widgets: WidgetDefinition[]
  visibleWidgets: string[]
  onToggle: (id: string) => void
}

export default function WidgetSettingsPanel({ open, onOpenChange, widgets, visibleWidgets, onToggle }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {widgets.map((w) => {
            const isOn = visibleWidgets.includes(w.id)
            return (
              <button
                key={w.id}
                onClick={() => onToggle(w.id)}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-[10px] hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-sm font-medium text-body">{w.label}</span>
                <div
                  className={`w-9 h-5 rounded-full transition-colors ${
                    isOn ? "bg-primary-500" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform mt-[3px] ${
                      isOn ? "translate-x-[18px]" : "translate-x-[3px]"
                    }`}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
