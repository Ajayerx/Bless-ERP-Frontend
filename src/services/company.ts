import { apiClient } from "./api-client"
import { getLoggedInUserId } from "./auth.service"

export interface CompanyDefaults {
  company: string
  currency: string
  defaultSellingPriceList: string
  defaultReceivableAccount: string
  defaultIncomeAccount: string
  defaultCostCenter: string
  companyTaxId: string
  defaultLetterHead: string
  defaultCashAccount: string
  defaultBankAccount: string
  writeOffAccount: string
  exchangeGainLossAccount: string
  costCenter: string
}

export function emptyDefaults(company: string): CompanyDefaults {
  return {
    company,
    currency: "CAD",
    defaultSellingPriceList: "Standard Selling",
    defaultReceivableAccount: "",
    defaultIncomeAccount: "",
    defaultCostCenter: "",
    companyTaxId: "",
    defaultLetterHead: "",
    defaultCashAccount: "",
    defaultBankAccount: "",
    writeOffAccount: "",
    exchangeGainLossAccount: "",
    costCenter: "",
  }
}

// Company defaults are cached per company name. A single module-level cache was
// wrong in two ways: it handed the first company's defaults to every later
// caller even after the user switched company in the Company Switcher, and it
// hid the fact that a document could be built against one company while the
// X-Frappe-Company header carried another.
const defaultsCache = new Map<string, CompanyDefaults>()
const pendingFetches = new Map<string, Promise<CompanyDefaults>>()

export function resetCompanyDefaultsCache(company?: string): void {
  if (company) {
    defaultsCache.delete(company)
    pendingFetches.delete(company)
  } else {
    defaultsCache.clear()
    pendingFetches.clear()
  }
}

export async function listCompanies(): Promise<string[]> {
  const rows = await apiClient<{ name: string }[]>(
    "/resource/Company?fields=" + encodeURIComponent(JSON.stringify(["name"])) + "&limit_page_length=100&order_by=name",
  )
  return (rows ?? []).map((r) => r.name).filter(Boolean)
}

/**
 * Resolves the company to use when the caller has no explicit selection.
 *
 * Returns "" when it cannot be determined unambiguously — deliberately. The
 * previous implementation invented the literal "Bless Erp" as a last resort,
 * which is not a real company on most sites: it produced `company: "Bless Erp"`
 * on every document (rejected by ERPNext's mandatory validation) and made
 * every company-scoped Account search return zero rows, because Account is a
 * child doctype of Company. Callers must handle "" by surfacing a selector
 * instead of posting a bogus name.
 */
export async function resolveCompany(): Promise<string> {
  const companies = await listCompanies().catch(() => [] as string[])
  const known = new Set(companies)

  try {
    const globalDefaults = await apiClient<{ default_company?: string }>(
      "/resource/Global Defaults/Global Defaults?fields=" +
      encodeURIComponent(JSON.stringify(["default_company"])),
    )
    const globalCompany = globalDefaults?.default_company
    if (globalCompany && (known.size === 0 || known.has(globalCompany))) return globalCompany
  } catch {
    // fall through to the user's own default
  }

  try {
    const userId = await getLoggedInUserId()
    if (userId) {
      const user = await apiClient<{ default_company?: string }>(
        `/resource/User/${encodeURIComponent(userId)}?fields=` +
        encodeURIComponent(JSON.stringify(["default_company"])),
      )
      const userCompany = user?.default_company
      if (userCompany && (known.size === 0 || known.has(userCompany))) return userCompany
    }
  } catch {
    // fall through
  }

  if (companies.length === 1) return companies[0]
  if (companies.length === 0) return ""

  // Several companies and no configured default: only the first is correct by
  // ERPNext's own convention for an unambiguous single-choice default, so
  // return "" and let the caller ask.
  return ""
}

export async function getCompanyDefaults(company?: string): Promise<CompanyDefaults> {
  const resolved = company || (await resolveCompany())
  if (!resolved) {
    return emptyDefaults("")
  }

  const cached = defaultsCache.get(resolved)
  if (cached) return cached

  const pending = pendingFetches.get(resolved)
  if (pending) return pending

  const request = (async () => {
    try {
      const [companyDoc, sellingSettings] = await Promise.all([
        apiClient<Record<string, unknown>>(
          `/resource/Company/${encodeURIComponent(resolved)}?fields=${encodeURIComponent(JSON.stringify(["default_currency", "default_receivable_account", "default_income_account", "default_cost_center", "tax_id", "default_letter_head", "default_cash_account", "default_bank_account", "write_off_account", "exchange_gain_loss_account", "cost_center"]))}`
        ),
        apiClient<Record<string, unknown>>(
          "/resource/Selling Settings/Selling Settings?fields=" +
          encodeURIComponent(JSON.stringify(["selling_price_list"])),
        ),
      ])

      const defaults: CompanyDefaults = {
        company: resolved,
        currency: (companyDoc.default_currency as string) || "CAD",
        defaultSellingPriceList: (sellingSettings.selling_price_list as string) || "Standard Selling",
        // No fabricated account literal: an invented receivable account would
        // silently point documents at an account the site may not have. Callers
        // already fall back to "" and let the user pick.
        defaultReceivableAccount: (companyDoc.default_receivable_account as string) || "",
        defaultIncomeAccount: (companyDoc.default_income_account as string) || "",
        defaultCostCenter: (companyDoc.default_cost_center as string) || "",
        companyTaxId: (companyDoc.tax_id as string) || "",
        defaultLetterHead: (companyDoc.default_letter_head as string) || "",
        defaultCashAccount: (companyDoc.default_cash_account as string) || "",
        defaultBankAccount: (companyDoc.default_bank_account as string) || "",
        writeOffAccount: (companyDoc.write_off_account as string) || "",
        exchangeGainLossAccount: (companyDoc.exchange_gain_loss_account as string) || "",
        costCenter: (companyDoc.cost_center as string) || "",
      }

      defaultsCache.set(resolved, defaults)
      return defaults
    } finally {
      pendingFetches.delete(resolved)
    }
  })()

  pendingFetches.set(resolved, request)
  return request
}

export async function getCompany(): Promise<string> {
  const defaults = await getCompanyDefaults()
  return defaults.company
}
