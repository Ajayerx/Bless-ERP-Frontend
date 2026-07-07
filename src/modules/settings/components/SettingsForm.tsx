"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Save, Building, User, Bell, Shield, Palette, FileText, Globe, Banknote, MapPin, Upload, Phone, Mail, Link, Calendar, FileDigit, Hash, Building2 } from "lucide-react"
import { Card, CardContent, Button, Input, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui"
import { settingsService, type Settings } from "@/services"

import ProfileTab from "./ProfileTab"
import NotificationsTab from "./NotificationsTab"
import SecurityTab from "./SecurityTab"
import AppearanceTab from "./AppearanceTab"

const SETTINGS_TABS = [
  { id: "general", label: "General", icon: Building },
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "taxes", label: "Tax & Invoicing", icon: FileText },
]

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "general"
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    settingsService.get().then(setSettings).catch(() => null)
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await settingsService.update(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const updateCompany = (field: string, value: string | number) =>
    setSettings((s) => s ? { ...s, company: { ...s.company, [field]: value } } : s)

  const fieldClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">Settings</h1>
          <p className="text-sm text-muted mt-1">Manage your business configuration.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(tab) => setSearchParams({ tab }, { replace: true })}>
        <TabsList>
          {SETTINGS_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              <tab.icon size={15} />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general">
          <div className="max-w-2xl space-y-4">
            {/* Business Identity */}
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Building2 size={16} className="text-primary-600" />
                  <span className="text-sm font-semibold text-heading">Business Identity</span>
                </div>

                {/* Logo */}
                <div className="flex items-center gap-4 pb-2">
                  <div className="w-14 h-14 rounded-[12px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 overflow-hidden">
                    {settings?.company.logo ? (
                      <img src={settings.company.logo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building size={24} />
                    )}
                  </div>
                  <button className="px-3 py-1.5 text-xs font-semibold text-primary-600 bg-primary-50 rounded-[10px] hover:bg-primary-100 transition-colors flex items-center gap-1.5">
                    <Upload size={13} /> Upload Logo
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Company Name</label>
                    <Input value={settings?.company.name ?? ""} onChange={(e) => updateCompany("name", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>
                      <span className="inline-flex items-center gap-1"><Hash size={12} /> Abbreviation</span>
                    </label>
                    <Input value={settings?.company.abbr ?? ""} onChange={(e) => updateCompany("abbr", e.target.value)} placeholder="BLESS" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>
                      <span className="inline-flex items-center gap-1"><Globe size={12} /> Country</span>
                    </label>
                    <Input value={settings?.company.country ?? ""} onChange={(e) => updateCompany("country", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>
                      <span className="inline-flex items-center gap-1"><Banknote size={12} /> Default Currency</span>
                    </label>
                    <Input value={settings?.company.defaultCurrency ?? ""} onChange={(e) => updateCompany("defaultCurrency", e.target.value)} placeholder="CAD" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Tax ID</label>
                    <Input value={settings?.company.taxId ?? ""} onChange={(e) => updateCompany("taxId", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>
                      <span className="inline-flex items-center gap-1"><Calendar size={12} /> Date of Incorporation</span>
                    </label>
                    <Input type="date" value={settings?.company.dateOfIncorporation ?? ""} onChange={(e) => updateCompany("dateOfIncorporation", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Phone size={16} className="text-primary-600" />
                  <span className="text-sm font-semibold text-heading">Contact Information</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>
                      <span className="inline-flex items-center gap-1"><Mail size={12} /> Email</span>
                    </label>
                    <Input type="email" value={settings?.company.email ?? ""} onChange={(e) => updateCompany("email", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>
                      <span className="inline-flex items-center gap-1"><Phone size={12} /> Phone</span>
                    </label>
                    <Input value={settings?.company.phone ?? ""} onChange={(e) => updateCompany("phone", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>
                      <span className="inline-flex items-center gap-1"><Link size={12} /> Website</span>
                    </label>
                    <Input value={settings?.company.website ?? ""} onChange={(e) => updateCompany("website", e.target.value)} placeholder="https://blesserp.com" />
                  </div>
                  <div>
                    <label className={labelClass}>Fax</label>
                    <Input value={settings?.company.fax ?? ""} onChange={(e) => updateCompany("fax", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address */}
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <MapPin size={16} className="text-primary-600" />
                  <span className="text-sm font-semibold text-heading">Address</span>
                </div>
                <textarea
                  value={settings?.company.address ?? ""}
                  onChange={(e) => updateCompany("address", e.target.value)}
                  rows={3}
                  className={fieldClass}
                  placeholder="Business address"
                />
              </CardContent>
            </Card>

            {/* Accounting Defaults (read-only reference) */}
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <FileDigit size={16} className="text-primary-600" />
                  <span className="text-sm font-semibold text-heading">Accounting Defaults</span>
                </div>
                <p className="text-xs text-muted">These reference accounts are set in your ERPNext Chart of Accounts.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Default Bank Account</label>
                    <input value={settings?.company.defaultBankAccount ?? ""} readOnly className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[12px] text-sm text-muted cursor-not-allowed" />
                  </div>
                  <div>
                    <label className={labelClass}>Default Cash Account</label>
                    <input value={settings?.company.defaultCashAccount ?? ""} readOnly className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[12px] text-sm text-muted cursor-not-allowed" />
                  </div>
                  <div>
                    <label className={labelClass}>Default Receivable</label>
                    <input value={settings?.company.defaultReceivableAccount ?? ""} readOnly className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[12px] text-sm text-muted cursor-not-allowed" />
                  </div>
                  <div>
                    <label className={labelClass}>Default Payable</label>
                    <input value={settings?.company.defaultPayableAccount ?? ""} readOnly className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[12px] text-sm text-muted cursor-not-allowed" />
                  </div>
                  <div>
                    <label className={labelClass}>Default Income</label>
                    <input value={settings?.company.defaultIncomeAccount ?? ""} readOnly className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[12px] text-sm text-muted cursor-not-allowed" />
                  </div>
                  <div>
                    <label className={labelClass}>Default Expense</label>
                    <input value={settings?.company.defaultExpenseAccount ?? ""} readOnly className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[12px] text-sm text-muted cursor-not-allowed" />
                  </div>
                  <div>
                    <label className={labelClass}>Default Cost Center</label>
                    <input value={settings?.company.defaultCostCenter ?? ""} readOnly className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[12px] text-sm text-muted cursor-not-allowed" />
                  </div>
                  <div>
                    <label className={labelClass}>Credit Limit</label>
                    <input value={settings?.company.creditLimit ? `${settings.company.creditLimit}` : ""} readOnly className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[12px] text-sm text-muted cursor-not-allowed" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="taxes">
          <div className="max-w-2xl space-y-4">
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <FileDigit size={16} className="text-primary-600" />
                  <span className="text-sm font-semibold text-heading">Tax Configuration</span>
                </div>
                <p className="text-xs text-muted">Tax rates are managed in your ERPNext backend under <strong>Accounting &rarr; Tax Rules</strong>. Values shown here are read-only.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>GST Rate</label>
                    <Input value={`${((settings?.taxes.gstRate ?? 0.05) * 100).toFixed(1)}%`} disabled />
                  </div>
                  <div>
                    <label className={labelClass}>QST Rate</label>
                    <Input value={`${((settings?.taxes.qstRate ?? 0.09975) * 100).toFixed(3)}%`} disabled />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Default Currency</label>
                    <Input value={settings?.defaults.currency ?? "CAD"} disabled />
                  </div>
                  <div>
                    <label className={labelClass}>Invoice Prefix</label>
                    <Input value={settings?.defaults.invoicePrefix ?? "INV-"} disabled />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="profile">
          {settings && (
            <ProfileTab
              profile={settings.profile}
              onChange={(profile) => setSettings((s) => s ? { ...s, profile } : s)}
            />
          )}
        </TabsContent>

        <TabsContent value="notifications">
          {settings && (
            <NotificationsTab
              notifications={settings.notifications}
              onChange={(notifications) => setSettings((s) => s ? { ...s, notifications } : s)}
            />
          )}
        </TabsContent>

        <TabsContent value="security">
          {settings && (
            <SecurityTab
              security={settings.security}
              onChange={(security) => setSettings((s) => s ? { ...s, security } : s)}
            />
          )}
        </TabsContent>

        <TabsContent value="appearance">
          {settings && (
            <AppearanceTab
              appearance={settings.appearance}
              onChange={(appearance) => setSettings((s) => s ? { ...s, appearance } : s)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
