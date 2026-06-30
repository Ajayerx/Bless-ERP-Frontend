"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Link, Badge, Modal } from "@/components/ui"
import { opportunityService, type Opportunity } from "@/services/opportunities.service"

const stageMap: Record<string, { label: string; variant: "warning" | "info" | "danger" | "success" | "muted" }> = {
  qualification: { label: "Qualification", variant: "warning" },
  proposal: { label: "Proposal", variant: "info" },
  negotiation: { label: "Negotiation", variant: "danger" },
  closed_won: { label: "Closed Won", variant: "success" },
  closed_lost: { label: "Closed Lost", variant: "muted" },
}

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    if (!id) return
    opportunityService.getById(id).then(setOpp).catch(() => null).finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await opportunityService.delete(id)
      navigate("/opportunities")
    } finally { setDeleting(false); setShowDeleteModal(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!opp) return <><Topbar /><div className="p-6 text-center text-muted">Opportunity not found</div></>

  const stage = stageMap[opp.stage] ?? { label: opp.stage, variant: "muted" as const }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/opportunities"><ArrowLeft size={18} /><span>Back to Opportunities</span></Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/opportunities/${id}/edit`)}><Edit size={14} /> Edit</Button>
            <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="text-danger-600 border-danger-200 hover:bg-danger-50"><Trash2 size={14} /> Delete</Button>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-heading">{opp.title}</h1>
            <Badge variant={stage.variant}>{stage.label}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted">Customer</span><p className="text-body font-medium">{opp.customerName}</p></div>
            <div><span className="text-muted">Value</span><p className="text-body font-medium">${opp.value.toLocaleString()}</p></div>
            <div><span className="text-muted">Probability</span><p className="text-body font-medium">{opp.probability}%</p></div>
            <div><span className="text-muted">Expected Close</span><p className="text-body font-medium">{opp.expectedClose}</p></div>
            <div><span className="text-muted">Assigned To</span><p className="text-body font-medium">{opp.assignedTo}</p></div>
          </div>
          {opp.notes && <div><span className="text-sm text-muted">Notes</span><p className="text-sm text-body mt-1">{opp.notes}</p></div>}
        </div>
      </motion.div>
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Opportunity">
        <p>Are you sure you want to delete <strong>{opp.title}</strong>?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleDelete} loading={deleting} className="bg-danger-600 hover:bg-danger-700">Delete</Button>
        </div>
      </Modal>
    </>
  )
}
