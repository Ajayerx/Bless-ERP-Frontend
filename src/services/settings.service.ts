import { apiClient } from "./api-client"

export interface CompanyInfo {
  name: string
  legalName: string
  address: string
  phone: string
  email: string
  website: string
  businessNumber: string
  gstNumber: string
  qstNumber: string
  province: string
}

export interface TaxConfig {
  gstRate: number
  qstRate: number
  gstEnabled: boolean
  qstEnabled: boolean
  qstProvinces: string[]
  defaultTaxLabel: string
}

export interface AppDefaults {
  paymentTerms: string
  invoicePrefix: string
  currency: string
  locale: string
  fiscalYearStart: string
  fiscalYearEnd: string
}

export interface AppUser {
  id: string
  name: string
  email: string
  role: string
  status: string
}

export interface UserProfile {
  displayName: string
  title: string
  department: string
  avatar: string | null
  signature: string
  phone: string
}

export interface NotificationPreferences {
  invoiceCreated: boolean
  paymentReceived: boolean
  orderConfirmed: boolean
  lowStock: boolean
  weeklyReport: boolean
  monthlyReport: boolean
  marketingEmails: boolean
}

export interface SecuritySettings {
  twoFactorEnabled: boolean
  sessionTimeoutMinutes: number
  passwordMinLength: number
  requireSpecialChars: boolean
  lastPasswordChange: string | null
}

export interface AppearanceSettings {
  theme: "light" | "dark" | "system"
  density: "compact" | "comfortable"
  language: string
  reducedMotion: boolean
}

export interface Settings {
  company: CompanyInfo
  taxes: TaxConfig
  defaults: AppDefaults
  users: AppUser[]
  profile: UserProfile
  notifications: NotificationPreferences
  security: SecuritySettings
  appearance: AppearanceSettings
}

interface SettingsService {
  get(): Promise<Settings>
  update(data: Partial<Settings>): Promise<Settings>
}

export const settingsService: SettingsService = {
  get: () => apiClient("/settings"),
  update: (data) =>
    apiClient("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
}
