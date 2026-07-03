"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Input, Link } from "@/components/ui"
import { leadService } from "@/services"

const sourceOptions = [
  { value: "website", label: "Website" }, { value: "referral", label: "Referral" },
  { value: "cold_call", label: "Cold Call" }, { value: "social_media", label: "Social Media" },
  { value: "event", label: "Event" }, { value: "other", label: "Other" },
]

export default function NewLead() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "", source: "website", estimatedValue: "", notes: "", assignedTo: "" })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email) return
    setSaving(true)
    try {
      await leadService.create({ ...form, estimatedValue: parseFloat(form.estimatedValue) || 0, status: "new" })
      navigate("/leads")
    } finally { setSaving(false) }
  }

  const inputClass = "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-lg mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-6">
          <Link to="/leads"><ArrowLeft size={18} /><span>Back</span></Link>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">New Lead</h1>
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>First Name *</label><input className={inputClass} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><label className={labelClass}>Last Name *</label><input className={inputClass} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Email *</label><input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className={labelClass}>Phone</label><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><label className={labelClass}>Company</label><input className={inputClass} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Source</label>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inputClass}>
                {sourceOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Est. Value ($)</label><input className={inputClass} type="number" min={0} value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} /></div>
          </div>
          <div><label className={labelClass}>Assigned To</label><input className={inputClass} value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} /></div>
          <div><label className={labelClass}>Notes</label><input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => navigate("/leads")}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.firstName || !form.lastName || !form.email}>Save Lead</Button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
