"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className = "",
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`border-b border-border last:border-b-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-3 text-base font-bold text-heading hover:text-primary-600 transition-colors"
      >
        {open ? (
          <ChevronDown size={15} className="text-muted flex-shrink-0" />
        ) : (
          <ChevronRight size={15} className="text-muted flex-shrink-0" />
        )}
        {title}
      </button>
      {open && <div className="pb-4 space-y-3">{children}</div>}
    </div>
  )
}
