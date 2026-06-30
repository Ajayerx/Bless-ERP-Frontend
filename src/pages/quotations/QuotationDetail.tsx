"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft, Edit, Trash2, FileText } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Badge, Modal } from "@/components/ui"
import { quotationService, type Quotation } from "@/services"

const statusMap: Record<string, { label: string; variant: "warning" | "info" | "success" | "danger" | "muted" }> = {
  draft: { label: "Draft", variant: "warning" },
  sent: { label: "Sent", variant: "info" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "danger" },
  converted: { label: "Converted", variant: "muted" },
}

export default function QuotationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    if (!id) return
    quotationService.getById(id).then(setQuotation).catch(() => null).finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await quotationService.delete(id)
      navigate("/quotations")
    } finally { setDeleting(false); setShowDeleteModal(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!quotation) return <><Topbar /><div className="p-6 text-center text-muted">Quotation not found</div></>

  const status = statusMap[quotation.status] ?? { label: quotation.status, variant: "warning" as const }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-3xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/quotations" className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={18} /><span>Back to Quotations</span>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/quotations/${id}/edit`)}><Edit size={14} /> Edit</Button>
            <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="text-danger-600 border-danger-200 hover:bg-danger-50"><Trash2 size={14} /> Delete</Button>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={24} className="text-primary-600" />
              <h1 className="text-2xl font-bold text-heading">{quotation.number}</h1>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted">Customer</span><p className="text-body font-medium">{quotation.customerName}</p></div>
            <div><span className="text-muted">Amount</span><p className="text-body font-medium">${quotation.total.toLocaleString()}</p></div>
            <div><span className="text-muted">Issue Date</span><p className="text-body font-medium">{quotation.issueDate}</p></div>
            <div><span className="text-muted">Valid Until</span><p className="text-body font-medium">{quotation.validUntil}</p></div>
          </div>
        </div>
      </motion.div>
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Quotation">
        <p>Are you sure you want to delete <strong>{quotation.number}</strong>?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleDelete} loading={deleting} className="bg-danger-600 hover:bg-danger-700">Delete</Button>
        </div>
      </Modal>
    </>
  )
}
