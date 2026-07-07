import { apiClient } from "@/services/api-client"
export type { CompanyInfo, TaxConfig, AppDefaults, AppUser, UserProfile, UserRole, NotificationPreferences, SecuritySettings, AppearanceSettings, Settings } from "../types"
import type { Settings } from "../types"

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

interface FrappeUserDoc {
  name: string
  full_name: string
  first_name: string
  last_name: string
  email: string
  user_image: string | null
  gender: string
  phone: string
  mobile_no: string
  birth_date: string
  location: string
  interest: string
  bio: string
  email_signature: string
  time_zone: string
  language: string
  desk_theme: "Light" | "Dark" | "Automatic"
  simultaneous_sessions: number
  login_after: number
  login_before: number
  restrict_ip: string
  last_login: string | null
  last_ip: string
  last_active: string | null
  user_type: string
  send_me_a_copy: number
  thread_notify: number
  allowed_in_mentions: number
}

interface FrappeCompanyDoc {
  company_name: string
  company_logo: string | null
  country: string
  default_currency: string
  tax_id: string
  phone_no: string
  email: string
  website: string
  fax: string
  date_of_incorporation: string
  date_of_establishment: string
  registration_details: string
  default_bank_account: string
  default_cash_account: string
  default_receivable_account: string
  default_payable_account: string
  default_income_account: string
  default_expense_account: string
  default_cost_center: string
  credit_limit: number
  default_inventory_account: string
  address_html: string
}

interface FrappeGlobalDefaults {
  default_company: string
  default_currency: string
  country: string
}

function mapTheme(t: string): "light" | "dark" | "system" {
  if (t === "Dark") return "dark"
  if (t === "Automatic") return "system"
  return "light"
}

function invertTheme(t: "light" | "dark" | "system"): "Light" | "Dark" | "Automatic" {
  if (t === "dark") return "Dark"
  if (t === "system") return "Automatic"
  return "Light"
}

function parseGstRates(company: FrappeCompanyDoc): { gstRate: number; qstRate: number; gstEnabled: boolean; qstEnabled: boolean } {
  // ERPNext doesn't have explicit GST/QST fields — this is Canada-specific
  // Default to reasonable values; backend should store these in company fields
  return { gstRate: 0.05, qstRate: 0.09975, gstEnabled: true, qstEnabled: false }
}

export const settingsService = {
  async get(): Promise<Settings | null> {
    const userId = getCookie("user_id")
    if (!userId || userId === "Guest") return null

    try {
      const [userDoc, globalDefaults] = await Promise.all([
        apiClient<FrappeUserDoc>(`/resource/User/${encodeURIComponent(userId)}`).catch(() => null),
        apiClient<FrappeGlobalDefaults>(`/resource/${encodeURIComponent("Global Defaults")}`).catch(() => null),
      ])

      const companyName = globalDefaults?.default_company
      const companyDoc = companyName
        ? await apiClient<FrappeCompanyDoc>(`/resource/Company/${encodeURIComponent(companyName)}`).catch(() => null)
        : null

      const gst = companyDoc ? parseGstRates(companyDoc) : { gstRate: 0.05, qstRate: 0.09975, gstEnabled: false, qstEnabled: false }

      const u = userDoc ?? ({} as FrappeUserDoc)

      return {
        company: {
          name: companyDoc?.company_name ?? "",
          legalName: companyDoc?.company_name ?? "",
          abbr: "",
          address: companyDoc?.address_html ?? "",
          phone: companyDoc?.phone_no ?? "",
          email: companyDoc?.email ?? "",
          website: companyDoc?.website ?? "",
          fax: companyDoc?.fax ?? "",
          businessNumber: "",
          gstNumber: "",
          qstNumber: "",
          province: "",
          country: companyDoc?.country ?? globalDefaults?.country ?? "",
          defaultCurrency: companyDoc?.default_currency ?? globalDefaults?.default_currency ?? "CAD",
          taxId: companyDoc?.tax_id ?? "",
          logo: companyDoc?.company_logo ?? null,
          dateOfIncorporation: companyDoc?.date_of_incorporation ?? "",
          dateOfEstablishment: companyDoc?.date_of_establishment ?? "",
          registrationDetails: companyDoc?.registration_details ?? "",
          defaultBankAccount: companyDoc?.default_bank_account ?? "",
          defaultCashAccount: companyDoc?.default_cash_account ?? "",
          defaultReceivableAccount: companyDoc?.default_receivable_account ?? "",
          defaultPayableAccount: companyDoc?.default_payable_account ?? "",
          defaultIncomeAccount: companyDoc?.default_income_account ?? "",
          defaultExpenseAccount: companyDoc?.default_expense_account ?? "",
          defaultCostCenter: companyDoc?.default_cost_center ?? "",
          creditLimit: companyDoc?.credit_limit ?? 0,
          defaultInventoryAccount: companyDoc?.default_inventory_account ?? "",
        },
        taxes: {
          ...gst,
          qstProvinces: ["QC"],
          defaultTaxLabel: "GST",
        },
        defaults: {
          paymentTerms: "Net 30",
          invoicePrefix: "INV-",
          currency: companyDoc?.default_currency ?? globalDefaults?.default_currency ?? "CAD",
          locale: u.language || "en-CA",
          fiscalYearStart: "2026-01-01",
          fiscalYearEnd: "2026-12-31",
        },
        users: [],
        profile: {
          displayName: u.full_name || u.first_name || u.name,
          firstName: u.first_name ?? "",
          lastName: u.last_name ?? "",
          email: u.email ?? "",
          title: "",
          department: "",
          avatar: u.user_image ?? null,
          signature: u.email_signature ?? "",
          phone: u.phone ?? "",
          mobileNo: u.mobile_no ?? "",
          gender: u.gender ?? "",
          birthDate: u.birth_date ?? "",
          location: u.location ?? "",
          interests: u.interest ?? "",
          bio: u.bio ?? "",
          timezone: u.time_zone ?? "",
        },
        roles: [],
        notifications: {
          invoiceCreated: true,
          paymentReceived: true,
          orderConfirmed: true,
          lowStock: true,
          weeklyReport: true,
          monthlyReport: false,
          marketingEmails: false,
          threadNotify: !!u.thread_notify,
          sendMeCopy: !!u.send_me_a_copy,
          allowedInMentions: !!u.allowed_in_mentions,
        },
        security: {
          twoFactorEnabled: false,
          sessionTimeoutMinutes: 60,
          passwordMinLength: 8,
          requireSpecialChars: true,
          lastPasswordChange: null,
          simultaneousSessions: u.simultaneous_sessions ?? 1,
          loginAfter: u.login_after != null ? String(u.login_after) : "",
          loginBefore: u.login_before != null ? String(u.login_before) : "",
          restrictIp: u.restrict_ip ?? "",
          lastLogin: u.last_login ?? null,
          lastIp: u.last_ip ?? "",
          lastActive: u.last_active ?? null,
          userType: u.user_type ?? "System User",
        },
        appearance: {
          theme: mapTheme(u.desk_theme || "Light"),
          density: "comfortable",
          language: u.language || "en",
          timezone: u.time_zone ?? "",
          reducedMotion: false,
          searchBar: true,
          formSidebar: true,
          timeline: true,
          bulkActions: true,
        },
      }
    } catch {
      return null
    }
  },

  async update(data: Partial<Settings>): Promise<void> {
    const userId = getCookie("user_id")
    if (!userId || userId === "Guest") return

    const updates: Record<string, unknown> = {}

    // Profile fields
    if (data.profile) {
      if (data.profile.firstName) updates.first_name = data.profile.firstName
      if (data.profile.lastName) updates.last_name = data.profile.lastName
      if (data.profile.phone) updates.phone = data.profile.phone
      if (data.profile.mobileNo) updates.mobile_no = data.profile.mobileNo
      if (data.profile.gender) updates.gender = data.profile.gender
      if (data.profile.birthDate) updates.birth_date = data.profile.birthDate
      if (data.profile.location) updates.location = data.profile.location
      if (data.profile.interests) updates.interest = data.profile.interests
      if (data.profile.bio) updates.bio = data.profile.bio
      if (data.profile.signature !== undefined) updates.email_signature = data.profile.signature
      if (data.profile.timezone) updates.time_zone = data.profile.timezone
    }

    // Appearance fields
    if (data.appearance) {
      if (data.appearance.theme) updates.desk_theme = invertTheme(data.appearance.theme)
      if (data.appearance.language) updates.language = data.appearance.language
      if (data.appearance.timezone) updates.time_zone = data.appearance.timezone
    }

    // Notification fields
    if (data.notifications) {
      if (data.notifications.threadNotify !== undefined) updates.thread_notify = data.notifications.threadNotify ? 1 : 0
      if (data.notifications.sendMeCopy !== undefined) updates.send_me_a_copy = data.notifications.sendMeCopy ? 1 : 0
      if (data.notifications.allowedInMentions !== undefined) updates.allowed_in_mentions = data.notifications.allowedInMentions ? 1 : 0
    }

    if (Object.keys(updates).length > 0) {
      await apiClient(`/resource/User/${encodeURIComponent(userId)}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      })
    }

    // Security fields – convert time strings to 0-24 integers
    if (data.security) {
      if (data.security.loginAfter) {
        const hours = parseInt(data.security.loginAfter.split(":")[0], 10)
        if (!isNaN(hours)) updates.login_after = hours
      }
      if (data.security.loginBefore) {
        const hours = parseInt(data.security.loginBefore.split(":")[0], 10)
        if (!isNaN(hours)) updates.login_before = hours
      }
      if (data.security.simultaneousSessions) updates.simultaneous_sessions = data.security.simultaneousSessions
      if (data.security.restrictIp) updates.restrict_ip = data.security.restrictIp
    }

    // Company updates
    if (data.company) {
      const globalDefaults = await apiClient<{ default_company: string }>(`/resource/${encodeURIComponent("Global Defaults")}`).catch(() => null)
      const companyName = globalDefaults?.default_company
      if (companyName) {
        const companyUpdates: Record<string, unknown> = {}
        if (data.company.phone) companyUpdates.phone_no = data.company.phone
        if (data.company.email) companyUpdates.email = data.company.email
        if (data.company.website) companyUpdates.website = data.company.website
        if (data.company.fax) companyUpdates.fax = data.company.fax
        if (Object.keys(companyUpdates).length > 0) {
          await apiClient(`/resource/Company/${encodeURIComponent(companyName)}`, {
            method: "PUT",
            body: JSON.stringify(companyUpdates),
          })
        }
      }
    }
  },
}
