"use client"

import { Palette, Monitor, Sun, Moon, Type, Globe, Eye } from "lucide-react"
import { Card, CardContent } from "@/components/ui"
import { Switch } from "@/components/ui/switch"
import type { AppearanceSettings } from "@/services"
import { cn } from "@/lib/utils"

interface AppearanceTabProps {
  appearance: AppearanceSettings
  onChange: (a: AppearanceSettings) => void
}

const THEMES = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
]

const DENSITIES = [
  { value: "comfortable" as const, label: "Comfortable", description: "More spacing and padding" },
  { value: "compact" as const, label: "Compact", description: "Tighter layout, more content visible" },
]

const LANGUAGES = [
  { value: "en-CA", label: "English (Canada)" },
  { value: "en-US", label: "English (US)" },
  { value: "fr-CA", label: "Français (Canada)" },
]

export default function AppearanceTab({ appearance, onChange }: AppearanceTabProps) {
  const update = (field: keyof AppearanceSettings, value: unknown) =>
    onChange({ ...appearance, [field]: value as never })

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Palette size={16} className="text-primary-600" />
            <span className="text-sm font-semibold text-heading">Theme</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => update("theme", value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-[12px] border-2 transition-all",
                  appearance.theme === value
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-border hover:border-gray-300 text-muted hover:text-body",
                )}
              >
                <Icon size={20} />
                <span className="text-xs font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Type size={16} className="text-primary-600" />
            <span className="text-sm font-semibold text-heading">Density</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {DENSITIES.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => update("density", value)}
                className={cn(
                  "text-left p-4 rounded-[12px] border-2 transition-all",
                  appearance.density === value
                    ? "border-primary-500 bg-primary-50"
                    : "border-border hover:border-gray-300",
                )}
              >
                <p className={cn("text-sm font-semibold", appearance.density === value ? "text-primary-700" : "text-heading")}>{label}</p>
                <p className="text-xs text-muted mt-0.5">{description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Globe size={16} className="text-primary-600" />
            <span className="text-sm font-semibold text-heading">Language & Region</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Language</label>
            <select
              value={appearance.language}
              onChange={(e) => update("language", e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            >
              {LANGUAGES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <Switch
              checked={appearance.reducedMotion}
              onChange={(v) => update("reducedMotion", v)}
              label={<span className="inline-flex items-center gap-1.5"><Eye size={13} /> Reduce motion (accessibility)</span>}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
