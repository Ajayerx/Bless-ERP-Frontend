"use client"

import { useState } from "react"
import { Search, ChevronDown } from "lucide-react"
import { type Customer } from "@/services"
import { cn } from "@/lib/utils"

interface CustomerSearchProps {
  customers: Customer[]
  value: string
  onSelect: (customer: Customer) => void
  className?: string
}

export default function CustomerSearch({ customers, value, onSelect, className }: CustomerSearchProps) {
  const selected = customers.find((c) => c.id === value)
  const [search, setSearch] = useState(selected?.name ?? "")
  const [open, setOpen] = useState(false)

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.contactName.toLowerCase().includes(search.toLowerCase()),
  )

  const handleSelect = (c: Customer) => {
    onSelect(c)
    setSearch(c.name)
    setOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search customer..."
        className="w-full pl-10 pr-10 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
      />
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
      {open && (
        <div className="absolute z-10 mt-1.5 w-full bg-surface border border-border rounded-[14px] shadow-xl max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No customers found</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm transition-colors",
                  c.id === value
                    ? "bg-primary-50 text-primary-700 font-semibold"
                    : "text-body hover:bg-gray-50",
                )}
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted ml-2">{c.contactName}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
