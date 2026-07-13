import { apiClient } from "./api-client"

export interface CompanyDefaults {
  company: string
  currency: string
  defaultSellingPriceList: string
  defaultReceivableAccount: string
  defaultIncomeAccount: string
  defaultCostCenter: string
}

let cachedDefaults: CompanyDefaults | null = null
let pendingFetch: Promise<CompanyDefaults> | null = null

export async function getCompanyDefaults(): Promise<CompanyDefaults> {
  if (cachedDefaults) return cachedDefaults
  if (pendingFetch) return pendingFetch

  pendingFetch = (async () => {
    try {
      const company = await resolveCompany()
      const [companyDoc, sellingSettings] = await Promise.all([
        apiClient<Record<string, unknown>>(
          `/resource/Company/${encodeURIComponent(company)}?fields=${encodeURIComponent(JSON.stringify(["default_currency", "default_receivable_account", "default_income_account", "default_cost_center"]))}`
        ),
        apiClient<Record<string, unknown>>(
          "/resource/Selling Settings/Selling Settings?fields=" +
          encodeURIComponent(JSON.stringify(["selling_price_list"]))
        ),
      ])

      const defaults: CompanyDefaults = {
        company,
        currency: (companyDoc.default_currency as string) || "CAD",
        defaultSellingPriceList: (sellingSettings.selling_price_list as string) || "Standard Selling",
        defaultReceivableAccount: (companyDoc.default_receivable_account as string) || "Debtors - BE",
        defaultIncomeAccount: (companyDoc.default_income_account as string) || "",
        defaultCostCenter: (companyDoc.default_cost_center as string) || "",
      }

      cachedDefaults = defaults
      return defaults
    } finally {
      pendingFetch = null
    }
  })()

  return pendingFetch
}

export async function getCompany(): Promise<string> {
  const defaults = await getCompanyDefaults()
  return defaults.company
}

async function resolveCompany(): Promise<string> {
  try {
    const globalDefaults = await apiClient<{ default_company?: string }>(
      "/resource/Global Defaults/Global Defaults?fields=" +
      encodeURIComponent(JSON.stringify(["default_company"]))
    )
    if (globalDefaults.default_company) return globalDefaults.default_company
  } catch {
    // fall through
  }

  const companies = await apiClient<{ name: string }[]>(
    "/resource/Company?fields=" + encodeURIComponent(JSON.stringify(["name"])) + "&limit_page_length=2"
  )
  if (companies.length === 1) return companies[0].name

  return "Bless Erp"
}
