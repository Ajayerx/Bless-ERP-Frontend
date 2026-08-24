import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface FilterPillsOption<T extends string> {
  value: T
  label: ReactNode
}

interface FilterPillsProps<T extends string> {
  options: readonly (T | FilterPillsOption<T>)[]
  value: T | undefined
  onChange: (value: T) => void
  className?: string
}

const baseCls =
  "px-4 py-1.5 rounded-[10px] text-sm font-semibold transition-colors"
const selectedCls = "bg-primary-600 text-primary-50 shadow-sm"
const unselectedCls = "text-muted hover:bg-gray-100 hover:text-body"

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  className,
}: FilterPillsProps<T>) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {options.map((opt) => {
        const v = typeof opt === "string" ? opt : opt.value
        const label = typeof opt === "string" ? opt : opt.label
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(baseCls, v === value ? selectedCls : unselectedCls)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
