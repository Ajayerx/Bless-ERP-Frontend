"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Zap } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import {
  Button, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui"
import { Input } from "@/components/ui/input"
import { opportunityService, customerService, type Customer } from "@/services"
import type { Opportunity } from "@/modules/crm/types"
import { formatCurrency, formatDate } from "@/lib/utils"

const stageStyles: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" | "purple" | "primary" }> = {
  prospecting: { label: "Prospecting", variant: "default" },
  qualification: { label: "Qualification", variant: "info" },
  proposal: { label: "Proposal", variant: "warning" },
  negotiation: { label: "Negotiation", variant: "purple" },
  closed_won: { label: "Closed Won", variant: "success" },
  closed_lost: { label: "Closed Lost", variant: "danger" },
}

const stageOptions = [
  { value: "prospecting", label: "Prospecting" },
  { value: "qualification", label: "Qualification" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
]

const columns: Column<Opportunity>[] = [
  {
    key: "name",
    header: "Opportunity",
    render: (o) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-purple-50 text-purple-600 flex items-center justify-center">
          <Zap size={16} />
        </div>
        <div>
          <p className="font-semibold text-heading">{o.name}</p>
          <p className="text-xs text-muted">{o.customerName}</p>
        </div>
      </div>
    ),
  },
  {
    key: "stage",
    header: "Stage",
    render: (o) => {
      const s = stageStyles[o.stage] ?? { label: o.stage, variant: "default" as const }
      return <Badge variant={s.variant}>{s.label}</Badge>
    },
  },
  {
    key: "estimatedValue",
    header: "Value",
    className: "text-right",
    render: (o) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(o.estimatedValue)}</span>,
  },
  {
    key: "probability",
    header: "Prob.",
    className: "text-right",
    render: (o) => (
      <div className="flex items-center gap-2 justify-end">
        <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${o.probability}%` }} />
        </div>
        <span className="text-sm font-semibold tabular-nums text-heading">{o.probability}%</span>
      </div>
    ),
  },
  {
    key: "expectedCloseDate",
    header: "Close Date",
    className: "text-right",
    render: (o) => <span className="text-sm text-muted tabular-nums">{formatDate(o.expectedCloseDate)}</span>,
  },
]

export default function Opportunities() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: Opportunity[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [form, setForm] = useState({
    name: "", customerId: "", stage: "prospecting" as string,
    probability: "15", expectedCloseDate: "", estimatedValue: "", assignedTo: "", notes: "",
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await opportunityService.list({ search, page, pageSize: 10 })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    customerService.list({ pageSize: 100 }).then((r) => setCustomers(r.items))
    const d = new Date(); d.setDate(d.getDate() + 30)
    setForm({
      name: "", customerId: "", stage: "prospecting", probability: "15",
      expectedCloseDate: d.toISOString().slice(0, 10), estimatedValue: "", assignedTo: "", notes: "",
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.customerId) return
    setSaving(true)
    try {
      const customer = customers.find((c) => c.id === form.customerId)
      await opportunityService.create({
        ...form,
        customerName: customer?.name || "",
        probability: parseInt(form.probability) || 0,
        estimatedValue: parseFloat(form.estimatedValue) || 0,
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
            <div className="p-2 rounded-[10px] bg-purple-50 text-purple-600"><Zap size={20} /></div>
            <div>
              <h1 className="text-2xl font-bold text-heading">Opportunities</h1>
              <p className="text-sm text-muted mt-1">Track sales opportunities through the pipeline.</p>
            </div>
          </div>
          <Button onClick={openCreate}><Plus size={16} /> Add Opportunity</Button>
        </div>
        {data && <p className="text-sm text-muted"><strong className="text-heading">{data.total}</strong> opportunities</p>}
        <DataTable
          columns={columns} data={data?.items ?? []} keyExtractor={(o) => o.id}
          searchable searchPlaceholder="Search opportunities..." searchQuery={search}
          onSearch={(q) => { setSearch(q); setPage(1) }}
          loading={loading} page={page} total={data?.total} pageSize={10} onPageChange={setPage}
          onRowClick={(o) => navigate(`/crm/opportunities/${o.id}`)}
        />

        <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Opportunity</DialogTitle>
              <DialogDescription>Create a new sales opportunity in the pipeline.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input label="Opportunity Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Customer</label>
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                  <option value="">Select customer...</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Stage</label>
                  <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                    {stageOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <Input label="Probability (%)" type="number" min={0} max={100} value={form.probability}
                  onChange={(e) => setForm({ ...form, probability: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Est. Value ($)" type="number" min={0} value={form.estimatedValue}
                  onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} />
                <Input label="Expected Close" type="date" value={form.expectedCloseDate}
                  onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} />
              </div>
              <Input label="Assigned To" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
              <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.customerId} loading={saving}>Save Opportunity</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </>
  )
}
