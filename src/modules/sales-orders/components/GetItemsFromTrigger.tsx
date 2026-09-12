"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui"
import GetItemsFromModal from "./GetItemsFromModal"

interface SetterField {
  fieldname: string
  label: string
}

interface GetItemsSource {
  key: string
  doctype: string
  method: string
  childFieldname?: string
  childDoctype?: string
  childColumns?: string[]
  setters?: SetterField[]
  searchQuery?: string
  makeDocRoute: string
}

const GET_ITEMS_SOURCES: GetItemsSource[] = [
  {
    key: "Quotation",
    doctype: "Quotation",
    method: "erpnext.selling.doctype.quotation.quotation.make_sales_order",
    childFieldname: "items",
    childDoctype: "Quotation Item",
    childColumns: ["item_code", "item_name", "qty", "rate", "amount"],
    setters: [{ fieldname: "party_name", label: "Customer" }],
    makeDocRoute: "/quotations/new",
  },
]

interface GetItemsFromTriggerProps {
  customer?: string
  company?: string
  formData?: Record<string, unknown>
  onItemsFetched: (items: Array<Record<string, unknown>>) => void
  disabled?: boolean
}

export default function GetItemsFromTrigger({
  customer,
  company,
  formData,
  onItemsFetched,
  disabled,
}: GetItemsFromTriggerProps) {
  const navigate = useNavigate()
  const [activeSource, setActiveSource] = useState<GetItemsSource | null>(null)

  const selectSource = (key: string) => {
    const source = GET_ITEMS_SOURCES.find((s) => s.key === key)
    if (source) setActiveSource(source)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Get Items From
            <ChevronDown size={13} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => selectSource("Quotation")}>
            Quotation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {activeSource && (
        <GetItemsFromModal
          open={!!activeSource}
          onOpenChange={(open) => {
            if (!open) setActiveSource(null)
          }}
          sourceDoctype={activeSource.doctype}
          method={activeSource.method}
          title={`Select ${activeSource.key}`}
          setters={
            activeSource.setters?.map((s) => ({
              fieldname: s.fieldname,
              label: s.label,
              defaultValue: customer,
            }))
          }
          childDoctype={activeSource.childDoctype}
          childFieldname={activeSource.childFieldname}
          childColumns={activeSource.childColumns}
          customer={customer}
          company={company}
          formData={formData}
          searchQuery={activeSource.searchQuery}
          makeDocLabel={activeSource.key}
          onMakeDoc={(setterValues) => {
            const params = new URLSearchParams()
            for (const s of activeSource.setters ?? []) {
              const v = setterValues?.[s.fieldname]
              if (v) params.set(s.fieldname, v)
            }
            const qs = params.toString()
            navigate(
              qs ? `${activeSource.makeDocRoute}?${qs}` : activeSource.makeDocRoute,
            )
            setActiveSource(null)
          }}
          onItemsFetched={(fetchedItems) => {
            onItemsFetched(fetchedItems)
            setActiveSource(null)
          }}
        />
      )}
    </>
  )
}
