"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./dropdown-menu"

export interface ListBulkActionItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  show?: boolean
  danger?: boolean
  separatorBefore?: boolean
  disabled?: boolean
}

interface ListBulkActionsProps {
  /** Number of currently selected rows. 0 => no selection. */
  count: number
  /** Menu items. `show` defaults to true; only rendered when count > 0. */
  items: ListBulkActionItem[]
  /** Plural noun for the "{n} selected" label, e.g. "invoices", "payments". */
  noun: string
  /** Rendered in place of the dropdown when nothing is selected. */
  fallback?: React.ReactNode
  className?: string
}

export default function ListBulkActions({
  count,
  items,
  noun,
  fallback,
  className,
}: ListBulkActionsProps) {
  if (count === 0) {
    if (!fallback) return null
    return <div className={cn("flex items-center gap-2", className)}>{fallback}</div>
  }

  const visible = items.filter((i) => (i.show ?? true))

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-muted mr-1">
        {count} {noun} selected
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm">
            Actions
            <ChevronDown size={13} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {visible.map((item, idx) => {
            const node = (
              <DropdownMenuItem
                key={item.label}
                onClick={item.onClick}
                disabled={item.disabled || count === 0}
                className={cn(item.danger && "text-danger-600 data-[highlighted]:text-danger-700")}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            )
            if (item.separatorBefore) {
              return (
                <React.Fragment key={idx}>
                  <DropdownMenuSeparator />
                  {node}
                </React.Fragment>
              )
            }
            return node
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
