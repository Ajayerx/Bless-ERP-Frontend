"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Phone, Mail, Building2, Briefcase } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import {
  Button, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui"
import { Input } from "@/components/ui/input"
import { contactService, customerService, type Customer } from "@/services"
import type { Contact } from "@/modules/crm/types"

const columns: Column<Contact>[] = [
  {
    key: "name",
    header: "Contact",
    render: (c) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-sm font-bold">
          {c.firstName[0]}{c.lastName[0]}
        </div>
        <div>
          <p className="font-semibold text-heading">{c.firstName} {c.lastName}</p>
          <p className="text-xs text-muted">{c.jobTitle}</p>
        </div>
      </div>
    ),
  },
  {
    key: "company",
    header: "Company",
    render: (c) => (
      <div className="flex items-center gap-2">
        <Building2 size={14} className="text-muted shrink-0" />
        <span className="text-sm text-body">{c.company}</span>
      </div>
    ),
  },
  {
    key: "email",
    header: "Contact",
    hideOnMobile: true,
    render: (c) => (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-sm text-muted">
          <Mail size={12} /> {c.email}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted">
          <Phone size={12} /> {c.phone}
        </div>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (c) => (
      <Badge variant={c.status === "active" ? "success" : "default"}>
        {c.status === "active" ? "Active" : "Inactive"}
      </Badge>
    ),
  },
]

export default function Contacts() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: Contact[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", jobTitle: "", company: "", customerId: "", notes: "",
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await contactService.list({ search, page, pageSize: 10 })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    customerService.list({ pageSize: 100 }).then((r) => setCustomers(r.items))
    setForm({ firstName: "", lastName: "", email: "", phone: "", jobTitle: "", company: "", customerId: "", notes: "" })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email) return
    setSaving(true)
    try {
      const customer = customers.find((c) => c.id === form.customerId)
      await contactService.create({
        ...form,
        company: form.company || customer?.name || "",
        status: "active",
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
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-primary-50 text-primary-600">
              <Briefcase size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Contacts</h1>
              <p className="text-sm text-muted mt-1">Manage your contact directory.</p>
            </div>
          </div>
          <Button onClick={openCreate}><Plus size={16} /> Add Contact</Button>
        </div>

        {data && (
          <p className="text-sm text-muted"><strong className="text-heading">{data.total}</strong> contacts</p>
        )}

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(c) => c.id}
          searchable searchPlaceholder="Search contacts..."
          searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading}
          page={page}
          total={data?.total}
          pageSize={10}
          onPageChange={setPage}
          onRowClick={(c) => navigate(`/crm/contacts/${c.id}`)}
        />

        <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Contact</DialogTitle>
              <DialogDescription>Add a new person to your contact directory.</DialogDescription>
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
              <Input label="Job Title" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Company</label>
                <select value={form.customerId} onChange={(e) => {
                  const c = customers.find((c) => c.id === e.target.value)
                  setForm({ ...form, customerId: e.target.value, company: c?.name || "" })
                }}
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                  <option value="">No company</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
              <Button onClick={handleSave} disabled={saving || !form.firstName || !form.lastName || !form.email} loading={saving}>
                Save Contact
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </>
  )
}
