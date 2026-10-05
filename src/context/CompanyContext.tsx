import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { apiClient, setActiveCompany } from "../services/api-client"
import { getCompanyDefaults, resetCompanyDefaultsCache, type CompanyDefaults } from "../services/company"

const STORAGE_KEY = "blesserp_selected_company"

interface CompanyInfo {
  name: string
  companyName: string
  defaultCurrency: string
  taxId: string
}

interface CompanyContextType {
  companies: CompanyInfo[]
  selectedCompany: string
  selectedCompanyInfo: CompanyInfo | null
  companyDefaults: CompanyDefaults | null
  defaultCurrency: string
  loading: boolean
  selectCompany: (companyName: string) => void
}

const CompanyContext = createContext<CompanyContextType | null>(null)

function loadSelectedCompany(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || ""
  } catch {
    return ""
  }
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<CompanyInfo[]>([])
  const [selectedCompany, setSelectedCompanyState] = useState<string>(loadSelectedCompany)
  const [companyDefaults, setCompanyDefaults] = useState<CompanyDefaults | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch all companies on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await apiClient<{ name: string; company_name: string; default_currency: string; tax_id: string }[]>(
          "/resource/Company?fields=" +
            encodeURIComponent(JSON.stringify(["name", "company_name", "default_currency", "tax_id"])) +
            "&limit_page_length=100&order_by=name"
        )
        if (cancelled) return
        const list: CompanyInfo[] = rows.map((r) => ({
          name: r.name,
          companyName: r.company_name || r.name,
          defaultCurrency: r.default_currency || "CAD",
          taxId: r.tax_id || "",
        }))
        setCompanies(list)

        // No stored selection yet: prefer the site's own default. resolveCompany()
        // returns "" when several companies exist with nothing configured, in
        // which case the switcher stays closed and the affected workspaces show
        // a Company selector rather than posting a fabricated name.
        if (!selectedCompany) {
          const defaults = await getCompanyDefaults()
          if (!cancelled && defaults.company) setSelectedCompanyState(defaults.company)
        }
        // Set active company for api-client header
        setActiveCompany(selectedCompany || "")
      } catch {
        // Silently fail — company list is non-critical
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch company defaults for the *selected* company. Passing the company in
  // is what makes this correct: getCompanyDefaults() on its own resolves the
  // site default, which can differ from the company the user switched to and
  // then disagree with the X-Frappe-Company header sent by api-client.
  useEffect(() => {
    if (!selectedCompany) {
      setCompanyDefaults(null)
      return
    }
    setActiveCompany(selectedCompany)
    let cancelled = false
    ;(async () => {
      try {
        const defaults = await getCompanyDefaults(selectedCompany)
        if (!cancelled) setCompanyDefaults(defaults)
      } catch {
        // Silently fail
      }
    })()
    return () => { cancelled = true }
  }, [selectedCompany])

  const selectCompany = useCallback((companyName: string) => {
    // Drop the outgoing company's cached defaults before the reload so nothing
    // can read them under the new company's header.
    resetCompanyDefaultsCache()
    setActiveCompany(companyName)
    setSelectedCompanyState(companyName)
    try {
      localStorage.setItem(STORAGE_KEY, companyName)
    } catch {
      // storage unavailable (private mode) — the in-memory value still applies
    }
    // Force page reload to re-fetch all data with new company context
    window.location.reload()
  }, [])

  const selectedCompanyInfo = companies.find((c) => c.name === selectedCompany) || null
  const defaultCurrency = selectedCompanyInfo?.defaultCurrency || companyDefaults?.currency || "CAD"

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompany,
        selectedCompanyInfo,
        companyDefaults,
        defaultCurrency,
        loading,
        selectCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider")
  return ctx
}
