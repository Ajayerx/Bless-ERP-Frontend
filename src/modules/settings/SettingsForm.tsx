"use client"

import { useEffect, useState } from "react"
import { Save, Building, User, Bell, Shield, Palette, FileText } from "lucide-react"
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
  const [activeTab, setActiveTab] = useState("general")
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

  const updateCompany = (field: string, value: string) =>
    setSettings((s) => s ? { ...s, company: { ...s.company, [field]: value } } : s)

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {SETTINGS_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              <tab.icon size={15} />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general">
          <Card className="max-w-2xl">
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-heading">Business Name</label>
                <Input value={settings?.company.name ?? ""} onChange={(e) => updateCompany("name", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold text-heading">Business Address</label>
                <textarea className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 min-h-[80px] resize-none"
                  value={settings?.company.address ?? ""} onChange={(e) => updateCompany("address", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-heading">Email</label>
                  <Input value={settings?.company.email ?? ""} onChange={(e) => updateCompany("email", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-heading">Phone</label>
                  <Input value={settings?.company.phone ?? ""} onChange={(e) => updateCompany("phone", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxes">
          <Card className="max-w-2xl">
            <CardContent className="space-y-4">
              <p className="text-sm text-muted">Tax configuration is managed in <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">src/config/tax.config.ts</code>.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-heading">GST Rate</label>
                  <Input value={`${((settings?.taxes.gstRate ?? 0.05) * 100).toFixed(1)}%`} disabled />
                </div>
                <div>
                  <label className="text-sm font-semibold text-heading">QST Rate</label>
                  <Input value={`${((settings?.taxes.qstRate ?? 0.09975) * 100).toFixed(3)}%`} disabled />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-heading">Currency</label>
                <Input value={settings?.defaults.currency ?? "CAD"} disabled />
              </div>
            </CardContent>
          </Card>
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
