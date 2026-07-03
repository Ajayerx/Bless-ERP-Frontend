"use client"

import { useState, useEffect } from "react"
import { Search, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { type Customer } from "@/services"
import { cn } from "@/lib/utils"

interface FormData {
  customerId: string
  customerName: string
  billTo: string
  issueDate: string
  dueDate: string
}

interface InvoiceFormProps {
  customers: Customer[]
  formData: FormData
  onChange: (data: Partial<FormData>) => void
}

const inputClass =
  "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"

const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

export default function InvoiceForm({ customers, formData, onChange }: InvoiceFormProps) {
  const [search, setSearch] = useState(formData.customerName || "")
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    setSearch(formData.customerName || "")
  }, [formData.customerName])

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.contactName.toLowerCase().includes(search.toLowerCase()),
  )

  const selectCustomer = (c: Customer) => {
    onChange({ customerId: c.id, customerName: c.name, billTo: c.billingAddress })
    setSearch(c.name)
    setDropdownOpen(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setDropdownOpen(true)
              }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Search customer..."
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
            {dropdownOpen && (
              <div className="absolute z-10 mt-1.5 w-full bg-surface border border-border rounded-[14px] shadow-xl max-h-48 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted">No customers found</p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-sm transition-colors",
                        c.id === formData.customerId
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
          {formData.customerName && (
            <div>
              <label className={labelClass}>Bill To</label>
              <textarea
                value={formData.billTo}
                onChange={(e) => onChange({ billTo: e.target.value })}
                rows={2}
                className={inputClass}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Invoice Date</label>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(e) => onChange({ issueDate: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => onChange({ dueDate: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-muted">Terms: Net 30</p>
        </CardContent>
      </Card>
    </div>
  )
}
