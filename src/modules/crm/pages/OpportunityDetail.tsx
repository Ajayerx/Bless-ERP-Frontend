"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, User, Calendar, DollarSign, TrendingUp } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { opportunityService } from "@/services"
import type { Opportunity } from "@/modules/crm/types"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

const stageStyles: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" | "purple" | "primary" }> = {
  prospecting: { label: "Prospecting", variant: "default" },
  qualification: { label: "Qualification", variant: "info" },
  proposal: { label: "Proposal", variant: "warning" },
  negotiation: { label: "Negotiation", variant: "purple" },
  closed_won: { label: "Closed Won", variant: "success" },
  closed_lost: { label: "Closed Lost", variant: "danger" },
}

const pipelineStages = ["prospecting", "qualification", "proposal", "negotiation", "closed_won"]

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    opportunityService.getById(id).then(setOpp).finally(() => setLoading(false))
  }, [id])

  const handleUpdateStage = async (stage: Opportunity["stage"]) => {
    if (!id) return
    const updated = await opportunityService.update(id, { stage } as any)
    setOpp(updated)
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24 rounded-[16px]" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-[16px]" />)}
          </div>
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!opp) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Opportunity not found.</p>
          <Button className="mt-4" onClick={() => navigate("/crm/opportunities")}>Back to Opportunities</Button>
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
            <button onClick={() => navigate("/crm/opportunities")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{opp.name}</h1>
                <Badge variant={stageStyles[opp.stage]?.variant ?? "default"}>
                  {stageStyles[opp.stage]?.label ?? opp.stage}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">{opp.customerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {opp.stage !== "closed_won" && opp.stage !== "closed_lost" && (
              <>
                <Button variant="secondary" onClick={() => handleUpdateStage("closed_lost")}>Close Lost</Button>
                <Button onClick={() => {
                  const idx = pipelineStages.indexOf(opp.stage)
                  if (idx < pipelineStages.length - 1) handleUpdateStage(pipelineStages[idx + 1] as Opportunity["stage"])
                }}>
                  <TrendingUp size={14} /> Advance Stage
                </Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Pipeline Stage</p>
            <div className="flex items-center gap-1">
              {pipelineStages.map((stage, i) => {
                const currentIdx = pipelineStages.indexOf(opp.stage)
                const isPast = i < currentIdx
                const isCurrent = i === currentIdx
                const isWon = opp.stage === "closed_won"
                return (
                  <div key={stage} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className={cn(
                      "w-full h-2 rounded-full transition-colors",
                      isPast || (isCurrent && isWon) ? "bg-success-500" :
                      isCurrent ? "bg-primary-500" : "bg-gray-100"
                    )} />
                    <span className={cn(
                      "text-[10px] font-semibold",
                      isCurrent ? "text-primary-600" : "text-muted"
                    )}>
                      {stageStyles[stage]?.label ?? stage}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-primary-600 bg-primary-50"><User size={20} /></div>
              <div>
                <p className="text-sm text-muted">Customer</p>
                <p className="text-sm font-semibold text-heading">{opp.customerName}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-success-600 bg-success-50"><DollarSign size={20} /></div>
              <div>
                <p className="text-sm text-muted">Est. Value</p>
                <p className="text-sm font-semibold text-heading">{formatCurrency(opp.estimatedValue)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-warning-600 bg-warning-50"><TrendingUp size={20} /></div>
              <div>
                <p className="text-sm text-muted">Probability</p>
                <p className="text-sm font-semibold text-heading">{opp.probability}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-[10px] text-info-600 bg-info-50"><Calendar size={20} /></div>
              <div>
                <p className="text-sm text-muted">Close Date</p>
                <p className="text-sm font-semibold text-heading">{formatDate(opp.expectedCloseDate)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Row label="Customer" value={opp.customerName} />
              <Row label="Stage" value={stageStyles[opp.stage]?.label ?? opp.stage} />
              <Row label="Assigned To" value={opp.assignedTo || "—"} />
              <Row label="Expected Close" value={formatDate(opp.expectedCloseDate)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-body">{opp.notes || "No notes recorded."}</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-sm font-medium text-heading">{value}</p>
    </div>
  )
}
