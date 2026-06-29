"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Briefcase, Mail, Phone, Building2, User } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { contactService, opportunityService } from "@/services"
import type { Contact } from "@/modules/crm/types"
import { formatCurrency } from "@/lib/utils"

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [contact, setContact] = useState<Contact | null>(null)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      contactService.getById(id),
      opportunityService.list({ pageSize: 50 }),
    ]).then(([c, oppRes]) => {
      setContact(c)
      setOpportunities(oppRes.items.filter((o) => o.contactId === c.id))
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-[16px]" />)}
          </div>
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!contact) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Contact not found.</p>
          <Button className="mt-4" onClick={() => navigate("/crm/contacts")}>Back to Contacts</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/crm/contacts")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-lg font-bold">
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-heading">{contact.firstName} {contact.lastName}</h1>
                  <Badge variant={contact.status === "active" ? "success" : "default"}>
                    {contact.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted mt-0.5">{contact.jobTitle}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-info-600 bg-info-50"><Mail size={20} /></div>
              <div className="min-w-0">
                <p className="text-sm text-muted">Email</p>
                <p className="text-sm font-semibold text-heading truncate">{contact.email}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-success-600 bg-success-50"><Phone size={20} /></div>
              <div>
                <p className="text-sm text-muted">Phone</p>
                <p className="text-sm font-semibold text-heading">{contact.phone || "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-primary-600 bg-primary-50"><Building2 size={20} /></div>
              <div>
                <p className="text-sm text-muted">Company</p>
                <p className="text-sm font-semibold text-heading">{contact.company || "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Row icon={User} label="Full Name" value={`${contact.firstName} ${contact.lastName}`} />
              <Row icon={Mail} label="Email" value={contact.email} />
              <Row icon={Phone} label="Phone" value={contact.phone || "—"} />
              <Row icon={Briefcase} label="Job Title" value={contact.jobTitle || "—"} />
              <Row icon={Building2} label="Company" value={contact.company || "—"} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-body">{contact.notes || "No notes recorded."}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Open Opportunities ({opportunities.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Stage</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Value</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Prob.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {opportunities.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-muted">No opportunities linked to this contact.</td></tr>
                ) : opportunities.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                    onClick={() => navigate(`/crm/opportunities/${o.id}`)}>
                    <td className="px-5 py-3 text-sm font-medium text-heading">{o.name}</td>
                    <td className="px-5 py-3">
                      <StageBadge stage={o.stage} />
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold tabular-nums text-right">{formatCurrency(o.estimatedValue)}</td>
                    <td className="px-5 py-3 text-sm text-right">{o.probability}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={16} className="text-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-medium text-heading truncate">{value}</p>
      </div>
    </div>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" | "purple" }> = {
    prospecting: { label: "Prospecting", variant: "default" },
    qualification: { label: "Qualification", variant: "info" },
    proposal: { label: "Proposal", variant: "warning" },
    negotiation: { label: "Negotiation", variant: "purple" },
    closed_won: { label: "Closed Won", variant: "success" },
    closed_lost: { label: "Closed Lost", variant: "danger" },
  }
  const m = map[stage] ?? { label: stage, variant: "default" as const }
  return <Badge variant={m.variant}>{m.label}</Badge>
}
