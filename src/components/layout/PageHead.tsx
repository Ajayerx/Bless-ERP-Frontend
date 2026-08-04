"use client"

import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

interface PageHeadProps {
  eyebrow?: string
  title: string
  subtitle?: string
  badge?: ReactNode
  backTo?: string
  actions?: ReactNode
}

export default function PageHead({
  eyebrow,
  title,
  subtitle,
  badge,
  backTo,
  actions,
}: PageHeadProps) {
  return (
    <div className="bg-surface border-b border-border px-6 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {backTo && (
            <Link
              to={backTo}
              aria-label="Back"
              className="inline-flex items-center justify-center h-9 w-9 rounded-[10px] text-muted hover:text-heading hover:bg-gray-100 transition-colors shrink-0"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-medium text-muted">{eyebrow}</p>
            )}
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-heading truncate">{title}</h1>
              {badge}
            </div>
            {subtitle && <p className="text-[13px] text-muted truncate">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
