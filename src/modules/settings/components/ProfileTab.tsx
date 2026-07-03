"use client"

import { User, Upload, Signature } from "lucide-react"
import { Card, CardContent } from "@/components/ui"
import { Input } from "@/components/ui"
import type { UserProfile } from "@/services"

interface ProfileTabProps {
  profile: UserProfile
  onChange: (profile: UserProfile) => void
}

export default function ProfileTab({ profile, onChange }: ProfileTabProps) {
  const update = (field: keyof UserProfile, value: string) =>
    onChange({ ...profile, [field]: value })

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-5">
        <div className="flex items-center gap-4 pb-2">
          <div className="w-14 h-14 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <User size={24} />
          </div>
          <div>
            <p className="font-semibold text-heading">{profile.displayName}</p>
            <p className="text-xs text-muted">{profile.title}</p>
          </div>
          <button className="ml-auto px-3 py-1.5 text-xs font-semibold text-primary-600 bg-primary-50 rounded-[10px] hover:bg-primary-100 transition-colors flex items-center gap-1.5">
            <Upload size={13} /> Upload Photo
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Display Name</label>
            <Input value={profile.displayName} onChange={(e) => update("displayName", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Job Title</label>
            <Input value={profile.title} onChange={(e) => update("title", e.target.value)} placeholder="System Administrator" />
          </div>
          <div>
            <label className={labelClass}>Department</label>
            <Input value={profile.department} onChange={(e) => update("department", e.target.value)} placeholder="IT" />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <Input value={profile.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 (416) 555-0000" />
          </div>
        </div>

        <div>
          <label className={labelClass}>
            <span className="inline-flex items-center gap-1.5"><Signature size={13} /> Email Signature</span>
          </label>
          <textarea
            value={profile.signature}
            onChange={(e) => update("signature", e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Your email signature..."
          />
        </div>
      </CardContent>
    </Card>
  )
}
