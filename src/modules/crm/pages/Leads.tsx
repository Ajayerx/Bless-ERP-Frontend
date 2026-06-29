"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Target, Phone, Mail } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import {
  Button, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui"
import { Input } from "@/components/ui/input"
import { leadService } from "@/services"
import type { Lead } from "@/modules/crm/types"
import { formatCurrency } from "@/lib/utils"

const statusStyles: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" | "purple" }> = {
  new: { label: "New", variant: "info" },
  contacted: { label: "Contacted", variant: "warning" },
  qualified: { label: "Qualified", variant: "purple" },
  proposal: { label: "Proposal", variant: "primary" },
  lost: { label: "Lost", variant: "danger" },
}

const sourceOptions = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "cold_call", label: "Cold Call" },
  { value: "social_media", label: "Social Media" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
]

const columns: Column<Lead>[] = [
  {
    key: "name",
    header: "Lead",
    render: (l) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-warning-50 text-warning-600 flex items-center justify-center text-sm font-bold">
          {l.firstName[0]}{l.lastName[0]}
        </div>
        <div>
          <p className="font-semibold text-heading">{l.firstName} {l.lastName}</p>
          <p className="text-xs text-muted">{l.company}</p>
        </div>
      </div>
    ),
  },
  {
    key: "contact",
    header: "Contact",
    hideOnMobile: true,
    render: (l) => (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-sm text-muted"><Mail size={12} /> {l.email}</div>
        <div className="flex items-center gap-1.5 text-sm text-muted"><Phone size={12} /> {l.phone}</div>
      </div>
    ),
  },
  {
    key: "source",
    header: "Source",
    render: (l) => <span className="text-xs capitalize bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">{l.source.replace("_", " ")}</span>,
  },
  {
    key: "estimatedValue",
    header: "Value",
    className: "text-right",
    render: (l) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(l.estimatedValue)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (l) => {
      const s = statusStyles[l.status] ?? { label: l.status, variant: "default" as const }
      return <Badge variant={s.variant}>{s.label}</Badge>
    },
  },
]

export default function Leads() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: Lead[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", company: "",
    source: "website" as string, estimatedValue: "", notes: "", assignedTo: "",
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await leadService.list({ search, page, pageSize: 10 })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setForm({ firstName: "", lastName: "", email: "", phone: "", company: "", source: "website", estimatedValue: "", notes: "", assignedTo: "" })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email) return
    setSaving(true)
    try {
      await leadService.create({
        ...form,
        estimatedValue: parseFloat(form.estimatedValue) || 0,
        status: "new",
      })
      setFormOpen(false)
      fetchData()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-warning-50 text-warning-600"><Target size={20} /></div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Leads</h1>
              <p className="text-sm text-muted mt-1">Track and manage potential sales leads.</p>
            </div>
          </div>
          <Button onClick={openCreate}><Plus size={16} /> Add Lead</Button>
        </div>
        {data && <p className="text-sm text-muted"><strong className="text-heading">{data.total}</strong> leads</p>}
        <DataTable
          columns={columns} data={data?.items ?? []} keyExtractor={(l) => l.id}
          searchable searchPlaceholder="Search leads..." searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading} page={page} total={data?.total} pageSize={10} onPageChange={setPage}
          onRowClick={(l) => navigate(`/crm/leads/${l.id}`)}
        />

        <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Lead</DialogTitle>
              <DialogDescription>Enter the details of the new sales lead.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Source</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                    {sourceOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <Input label="Est. Value ($)" type="number" min={0} value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} />
              </div>
              <Input label="Assigned To" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
              <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
              <Button onClick={handleSave} disabled={saving || !form.firstName || !form.lastName || !form.email} loading={saving}>Save Lead</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </>
  )
}
