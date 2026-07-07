export interface CompanyInfo {
  name: string
  legalName: string
  abbr: string
  address: string
  phone: string
  email: string
  website: string
  fax: string
  businessNumber: string
  gstNumber: string
  qstNumber: string
  province: string
  country: string
  defaultCurrency: string
  taxId: string
  logo: string | null
  dateOfIncorporation: string
  dateOfEstablishment: string
  registrationDetails: string
  defaultBankAccount: string
  defaultCashAccount: string
  defaultReceivableAccount: string
  defaultPayableAccount: string
  defaultIncomeAccount: string
  defaultExpenseAccount: string
  defaultCostCenter: string
  creditLimit: number
  defaultInventoryAccount: string
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
  firstName: string
  lastName: string
  email: string
  title: string
  department: string
  avatar: string | null
  signature: string
  phone: string
  mobileNo: string
  gender: string
  birthDate: string
  location: string
  interests: string
  bio: string
  timezone: string
}

export interface UserRole {
  role: string
  blocked: boolean
}

export interface NotificationPreferences {
  invoiceCreated: boolean
  paymentReceived: boolean
  orderConfirmed: boolean
  lowStock: boolean
  weeklyReport: boolean
  monthlyReport: boolean
  marketingEmails: boolean
  threadNotify: boolean
  sendMeCopy: boolean
  allowedInMentions: boolean
}

export interface SecuritySettings {
  twoFactorEnabled: boolean
  sessionTimeoutMinutes: number
  passwordMinLength: number
  requireSpecialChars: boolean
  lastPasswordChange: string | null
  simultaneousSessions: number
  loginAfter: string
  loginBefore: string
  restrictIp: string
  lastLogin: string | null
  lastIp: string
  lastActive: string | null
  userType: string
}

export interface AppearanceSettings {
  theme: "light" | "dark" | "system"
  density: "compact" | "comfortable"
  language: string
  timezone: string
  reducedMotion: boolean
  searchBar: boolean
  formSidebar: boolean
  timeline: boolean
  bulkActions: boolean
}

export interface Settings {
  company: CompanyInfo
  taxes: TaxConfig
  defaults: AppDefaults
  users: AppUser[]
  profile: UserProfile
  roles: UserRole[]
  notifications: NotificationPreferences
  security: SecuritySettings
  appearance: AppearanceSettings
}
