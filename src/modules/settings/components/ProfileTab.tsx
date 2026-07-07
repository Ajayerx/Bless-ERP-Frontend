"use client"

import { User, Upload, Signature, Calendar, MapPin, Heart, FileText } from "lucide-react"
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

  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"
  const fieldClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const readOnlyClass =
    "w-full px-3 py-2.5 bg-gray-50 border border-border rounded-[12px] text-sm text-muted cursor-not-allowed"

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardContent className="space-y-5">
          {/* Avatar & Identity */}
          <div className="flex items-center gap-4 pb-2">
            <div className="w-14 h-14 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User size={24} />
              )}
            </div>
            <div>
              <p className="font-semibold text-heading">{profile.displayName}</p>
              <p className="text-xs text-muted">{profile.email}</p>
            </div>
            <button className="ml-auto px-3 py-1.5 text-xs font-semibold text-primary-600 bg-primary-50 rounded-[10px] hover:bg-primary-100 transition-colors flex items-center gap-1.5">
              <Upload size={13} /> Upload Photo
            </button>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name</label>
              <Input value={profile.firstName} onChange={(e) => update("firstName", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <Input value={profile.lastName} onChange={(e) => update("lastName", e.target.value)} />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={profile.email} readOnly className={readOnlyClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <Input value={profile.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 (416) 555-0000" />
            </div>
            <div>
              <label className={labelClass}>Mobile No</label>
              <Input value={profile.mobileNo} onChange={(e) => update("mobileNo", e.target.value)} placeholder="+1 (416) 555-1234" />
            </div>
            <div>
              <label className={labelClass}>Gender</label>
              <select
                value={profile.gender}
                onChange={(e) => update("gender", e.target.value)}
                className={fieldClass}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Personal */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                <span className="inline-flex items-center gap-1.5"><Calendar size={13} /> Birth Date</span>
              </label>
              <Input type="date" value={profile.birthDate} onChange={(e) => update("birthDate", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>
                <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> Location</span>
              </label>
              <Input value={profile.location} onChange={(e) => update("location", e.target.value)} placeholder="City, Country" />
            </div>
          </div>

          {/* Work */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Job Title</label>
              <Input value={profile.title} onChange={(e) => update("title", e.target.value)} placeholder="System Administrator" />
            </div>
            <div>
              <label className={labelClass}>Department</label>
              <Input value={profile.department} onChange={(e) => update("department", e.target.value)} placeholder="IT" />
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1.5"><Heart size={13} /> Interests</span>
            </label>
            <textarea
              value={profile.interests}
              onChange={(e) => update("interests", e.target.value)}
              rows={2}
              className={fieldClass}
              placeholder="Your interests (comma separated)"
            />
          </div>

          {/* Bio */}
          <div>
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1.5"><FileText size={13} /> Bio</span>
            </label>
            <textarea
              value={profile.bio}
              onChange={(e) => update("bio", e.target.value)}
              rows={3}
              className={fieldClass}
              placeholder="A short bio about yourself"
            />
          </div>

          {/* Email Signature */}
          <div>
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1.5"><Signature size={13} /> Email Signature</span>
            </label>
            <textarea
              value={profile.signature}
              onChange={(e) => update("signature", e.target.value)}
              rows={2}
              className={fieldClass}
              placeholder="Your email signature..."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
