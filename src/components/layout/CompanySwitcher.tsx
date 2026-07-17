import { Building2, Check, ChevronDown, RefreshCw } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui"
import { useCompany } from "@/context/CompanyContext"
import { cn } from "@/lib/utils"

export default function CompanySwitcher() {
  const { companies, selectedCompany, selectedCompanyInfo, loading, selectCompany } = useCompany()

  if (companies.length <= 1) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] hover:bg-gray-100 transition-colors text-left max-w-[200px]">
          <Building2 size={16} className="text-muted shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-heading truncate leading-tight">
              {loading ? "Loading..." : selectedCompanyInfo?.companyName || selectedCompany}
            </p>
            {selectedCompanyInfo && (
              <p className="text-[11px] text-muted truncate">{selectedCompanyInfo.defaultCurrency}</p>
            )}
          </div>
          <ChevronDown size={14} className="text-muted shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Building2 size={14} />
          Switch Company
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.name}
            onClick={() => {
              if (company.name !== selectedCompany) {
                selectCompany(company.name)
              }
            }}
            className={cn(
              "flex items-center gap-3 cursor-pointer",
              company.name === selectedCompany && "bg-primary-50",
            )}
          >
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-gray-100 shrink-0">
              <Building2 size={14} className="text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-heading truncate">{company.companyName}</p>
              <p className="text-[11px] text-muted">{company.defaultCurrency}{company.taxId ? ` · ${company.taxId}` : ""}</p>
            </div>
            {company.name === selectedCompany && (
              <Check size={14} className="text-primary-600 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => selectCompany(selectedCompany)}
          className="text-muted cursor-pointer"
        >
          <RefreshCw size={14} />
          Refresh Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
