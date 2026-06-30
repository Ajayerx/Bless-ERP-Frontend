"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Link, Badge, Modal } from "@/components/ui"
import { journalEntryService, type JournalEntry } from "@/services/journal_entries.service"

const statusMap: Record<string, { label: string; variant: "warning" | "success" }> = {
  draft: { label: "Draft", variant: "warning" },
  posted: { label: "Posted", variant: "success" },
}

export default function JournalEntryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    if (!id) return
    journalEntryService.getById(id).then(setEntry).catch(() => null).finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await journalEntryService.delete(id)
      navigate("/journal-entries")
    } finally { setDeleting(false); setShowDeleteModal(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!entry) return <><Topbar /><div className="p-6 text-center text-muted">Entry not found</div></>

  const status = statusMap[entry.status] ?? { label: entry.status, variant: "warning" as const }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/journal-entries"><ArrowLeft size={18} /><span>Back to Journal Entries</span></Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/journal-entries/${id}/edit`)}><Edit size={14} /> Edit</Button>
            <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="text-danger-600 border-danger-200 hover:bg-danger-50"><Trash2 size={14} /> Delete</Button>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-heading">{entry.number}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted">Date</span><p className="text-body font-medium">{entry.date}</p></div>
            <div><span className="text-muted">Description</span><p className="text-body font-medium">{entry.description}</p></div>
            <div><span className="text-muted">Account</span><p className="text-body font-medium">{entry.account}</p></div>
            <div><span className="text-muted">Counter Account</span><p className="text-body font-medium">{entry.counterAccount}</p></div>
            <div><span className="text-muted">Debit</span><p className="text-body font-medium">{entry.debit ? `$${entry.debit.toLocaleString()}` : "-"}</p></div>
            <div><span className="text-muted">Credit</span><p className="text-body font-medium">{entry.credit ? `$${entry.credit.toLocaleString()}` : "-"}</p></div>
          </div>
        </div>
      </motion.div>
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Journal Entry">
        <p>Are you sure you want to delete <strong>{entry.number}</strong>?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleDelete} loading={deleting} className="bg-danger-600 hover:bg-danger-700">Delete</Button>
        </div>
      </Modal>
    </>
  )
}
