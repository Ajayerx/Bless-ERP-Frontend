"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, User, Phone, Mail, Building2, DollarSign, Activity } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { leadService } from "@/services"
import type { Lead } from "@/modules/crm/types"
import { formatCurrency } from "@/lib/utils"

const statusStyles: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" | "purple" | "primary" }> = {
  new: { label: "New", variant: "info" },
  contacted: { label: "Contacted", variant: "warning" },
  qualified: { label: "Qualified", variant: "purple" },
  proposal: { label: "Proposal", variant: "primary" },
  lost: { label: "Lost", variant: "danger" },
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    leadService.getById(id).then(setLead).finally(() => setLoading(false))
  }, [id])

  const handleUpdateStatus = async (status: Lead["status"]) => {
    if (!id) return
    const updated = await leadService.update(id, { status } as any)
    setLead(updated)
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-[16px]" />)}
          </div>
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!lead) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Lead not found.</p>
          <Button className="mt-4" onClick={() => navigate("/crm/leads")}>Back to Leads</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/crm/leads")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-warning-50 text-warning-600 flex items-center justify-center text-lg font-bold">
                {lead.firstName[0]}{lead.lastName[0]}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-heading">{lead.firstName} {lead.lastName}</h1>
                  <Badge variant={statusStyles[lead.status]?.variant ?? "default"}>
                    {statusStyles[lead.status]?.label ?? lead.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted mt-0.5">{lead.company}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lead.status === "new" && <Button onClick={() => handleUpdateStatus("contacted")}>Mark Contacted</Button>}
            {lead.status === "contacted" && <Button onClick={() => handleUpdateStatus("qualified")}>Qualify Lead</Button>}
            {lead.status === "qualified" && <Button onClick={() => handleUpdateStatus("proposal")}>Send Proposal</Button>}
            {(lead.status === "new" || lead.status === "contacted" || lead.status === "qualified" || lead.status === "proposal") && (
              <Button variant="secondary" onClick={() => handleUpdateStatus("lost")}>Mark Lost</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-primary-600 bg-primary-50"><User size={20} /></div>
              <div>
                <p className="text-sm text-muted">Contact</p>
                <p className="text-sm font-semibold text-heading">{lead.firstName} {lead.lastName}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-success-600 bg-success-50"><Building2 size={20} /></div>
              <div>
                <p className="text-sm text-muted">Company</p>
                <p className="text-sm font-semibold text-heading">{lead.company || "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-warning-600 bg-warning-50"><DollarSign size={20} /></div>
              <div>
                <p className="text-sm text-muted">Est. Value</p>
                <p className="text-sm font-semibold text-heading">{formatCurrency(lead.estimatedValue)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-info-600 bg-info-50"><Activity size={20} /></div>
              <div>
                <p className="text-sm text-muted">Source</p>
                <p className="text-sm font-semibold text-heading capitalize">{lead.source.replace("_", " ")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Row icon={Mail} label="Email" value={lead.email} />
              <Row icon={Phone} label="Phone" value={lead.phone || "—"} />
              <Row icon={Building2} label="Company" value={lead.company || "—"} />
              <Row icon={User} label="Assigned To" value={lead.assignedTo || "—"} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-body">{lead.notes || "No notes recorded."}</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  )
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={16} className="text-muted shrink-0" />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-medium text-heading">{value}</p>
      </div>
    </div>
  )
}
