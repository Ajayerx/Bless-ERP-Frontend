import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CollapsibleSectionProps {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  badge?: string | number
  className?: string
}

export default function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
  badge,
  className,
}: CollapsibleSectionProps) {
  return (
    <div className={cn("bg-gray-50/50 rounded-[14px] p-4 border border-border/50", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-left pb-2.5 border-b border-border/60"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-heading transition-colors">
          <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
          {title}
          {badge !== undefined && badge !== "" && (
            <span className="text-primary-600 normal-case">{badge}</span>
          )}
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}
