"use client"

import { useState } from "react"
import { Shield, Key, Clock, CheckCircle2, AlertTriangle, Monitor, LogIn, Network, User as UserIcon } from "lucide-react"
import { Card, CardContent, Button, Input } from "@/components/ui"
import { Switch } from "@/components/ui/switch"
import type { SecuritySettings } from "@/services"

interface SecurityTabProps {
  security: SecuritySettings
  onChange: (s: SecuritySettings) => void
}

export default function SecurityTab({ security, onChange }: SecurityTabProps) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  const update = (field: keyof SecuritySettings, value: unknown) =>
    onChange({ ...security, [field]: value as never })

  const handleChangePassword = () => {
    setPasswordError("")
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required.")
      return
    }
    if (newPassword.length < security.passwordMinLength) {
      setPasswordError(`Password must be at least ${security.passwordMinLength} characters.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.")
      return
    }
    setPasswordChanged(true)
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
    setTimeout(() => setPasswordChanged(false), 3000)
  }

  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"
  const readOnlyClass = "w-full px-3 py-2 bg-gray-50 border border-border rounded-[12px] text-sm text-muted cursor-not-allowed"

  return (
    <div className="max-w-2xl space-y-4">
      {/* Change Password */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Key size={16} className="text-primary-600" />
            <span className="text-sm font-semibold text-heading">Change Password</span>
          </div>

          {passwordError && (
            <p className="flex items-center gap-1.5 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[10px]">
              <AlertTriangle size={14} /> {passwordError}
            </p>
          )}
          {passwordChanged && (
            <p className="flex items-center gap-1.5 text-sm text-success-600 bg-success-50 border border-success-100 px-3 py-2 rounded-[10px]">
              <CheckCircle2 size={14} /> Password changed successfully.
            </p>
          )}

          <div className="space-y-3">
            <div>
              <label className={labelClass}>Current Password</label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>New Password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={`Min ${security.passwordMinLength} chars`} />
              </div>
              <div>
                <label className={labelClass}>Confirm New Password</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
              </div>
            </div>
            <Button onClick={handleChangePassword} size="sm">Update Password</Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Shield size={16} className="text-primary-600" />
            <span className="text-sm font-semibold text-heading">Security Settings</span>
          </div>

          <div className="space-y-3">
            <Switch
              checked={security.twoFactorEnabled}
              onChange={(v) => update("twoFactorEnabled", v)}
              label="Enable two-factor authentication (2FA)"
            />
            <Switch
              checked={security.requireSpecialChars}
              onChange={(v) => update("requireSpecialChars", v)}
              label="Require special characters in passwords"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Session Timeout (minutes)</label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  value={security.sessionTimeoutMinutes}
                  onChange={(e) => update("sessionTimeoutMinutes", parseInt(e.target.value) || 60)}
                  className="w-40"
                />
              </div>
              <div>
                <label className={labelClass}>Minimum Password Length</label>
                <Input
                  type="number"
                  min={4}
                  max={64}
                  value={security.passwordMinLength}
                  onChange={(e) => update("passwordMinLength", parseInt(e.target.value) || 8)}
                  className="w-40"
                />
              </div>
            </div>
            {security.lastPasswordChange && (
              <div className="flex items-center gap-2 text-xs text-muted pt-2 border-t border-gray-50">
                <Clock size={12} />
                Last password change: {new Date(security.lastPasswordChange).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Session & Login Controls */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Monitor size={16} className="text-primary-600" />
            <span className="text-sm font-semibold text-heading">Session & Login</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelClass}>
                <span className="inline-flex items-center gap-1.5"><Monitor size={13} /> Simultaneous Sessions</span>
              </label>
              <Input
                type="number"
                min={1}
                max={20}
                value={security.simultaneousSessions}
                onChange={(e) => update("simultaneousSessions", parseInt(e.target.value) || 1)}
                className="w-40"
              />
              <p className="text-xs text-muted mt-1">Number of simultaneous login sessions allowed for this user.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-1.5"><LogIn size={13} /> Login After (24h)</span>
                </label>
                <Input
                  type="time"
                  value={security.loginAfter}
                  onChange={(e) => update("loginAfter", e.target.value)}
                />
                <p className="text-xs text-muted mt-1">Earliest login time (24-hour format).</p>
              </div>
              <div>
                <label className={labelClass}>Login Before (24h)</label>
                <Input
                  type="time"
                  value={security.loginBefore}
                  onChange={(e) => update("loginBefore", e.target.value)}
                />
                <p className="text-xs text-muted mt-1">Latest login time (24-hour format).</p>
              </div>
            </div>

            <div>
              <label className={labelClass}>
                <span className="inline-flex items-center gap-1.5"><Network size={13} /> Restrict IP</span>
              </label>
              <Input
                value={security.restrictIp}
                onChange={(e) => update("restrictIp", e.target.value)}
                placeholder="192.168.1.0/24, 10.0.0.1"
              />
              <p className="text-xs text-muted mt-1">Comma-separated list of allowed IP addresses or CIDR ranges.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Info */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <UserIcon size={16} className="text-primary-600" />
            <span className="text-sm font-semibold text-heading">User Audit</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>User Type</label>
              <input value={security.userType} readOnly className={readOnlyClass} />
            </div>
            <div>
              <label className={labelClass}>Last Login</label>
              <input value={security.lastLogin ? new Date(security.lastLogin).toLocaleString() : "N/A"} readOnly className={readOnlyClass} />
            </div>
            <div>
              <label className={labelClass}>Last IP</label>
              <input value={security.lastIp || "N/A"} readOnly className={readOnlyClass} />
            </div>
            <div>
              <label className={labelClass}>Last Active</label>
              <input value={security.lastActive ? new Date(security.lastActive).toLocaleString() : "N/A"} readOnly className={readOnlyClass} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
